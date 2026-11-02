import { getAccountToolAccessForUserId } from '@/features/account/server';
import { readContributorCapabilities, requireContributionScope, type ContributorAccess } from '@/features/contributor-access/server';
import { consumeRateLimit, RateLimitExceededError } from '@/infrastructure/security/abuseProtection';
import { campaignDraftListInput, campaignDraftExactInput, campaignDraftReceiptInput, campaignDraftCreateInput, campaignDraftSaveInput, campaignPlanningResult, campaignDraftReadResult, campaignDraftPage } from '../campaignDraftContract';
import { getAllowedCampaignActions, commitSocialCampaignDraft, commitSocialCampaignDraftSave, listSocialCampaigns } from './campaignStore';
import { getCampaignRecord, requireMarketingContentDatabase, MarketingContentStoreError } from './storeShared';
import { canSaveCampaignDraft, type MarketingContentPackage } from '../model';
async function accessFor(actorUserId:string):Promise<ContributorAccess> {
 const account=await getAccountToolAccessForUserId(actorUserId), contribution=await readContributorCapabilities(account);
 requireContributionScope(contribution,'campaigns.draft');
 return {...account,scopes:[...contribution.scopes]};
}
const invalid=()=>new MarketingContentStoreError('Provide a supported exact Campaign draft request.',400);
export async function consumeCampaignMutationLimit(actorUserId:string){const result=await consumeRateLimit({action:'marketing-content-campaign',identity:actorUserId,limit:60,windowSeconds:3600});if(!result.allowed)throw new RateLimitExceededError('Too many campaign changes.',result.retryAfterSeconds,{resource:'campaign_changes',maximum:60,unit:'attempts_per_hour'});}
async function readDraftCampaign(campaignId:string,access:ContributorAccess){
 try {const campaign=await getCampaignRecord(campaignId,access);if(!campaignDraftReadResult.safeParse({campaign,canSave:canSaveCampaignDraft(campaign,access)}).success)throw new MarketingContentStoreError('Stored Campaign projection is invalid.',503);return campaign;}
 catch(error){if(error instanceof MarketingContentStoreError&&error.status<500)throw error;throw new MarketingContentStoreError('Exact Campaign readback is unavailable; absence was not established.',503);}
}
export async function listCampaignDrafts(actorUserId:string,input:unknown){const access=await accessFor(actorUserId),parsed=campaignDraftListInput.safeParse(input);if(!parsed.success)throw invalid();try{const result=await listSocialCampaigns({access,...parsed.data});if(!campaignDraftPage.safeParse(result).success)throw new Error('Invalid projection');return result;}catch(error){if(error instanceof MarketingContentStoreError&&error.status<500)throw error;throw new MarketingContentStoreError('Campaign list is unavailable; no empty fallback was substituted.',503);}}
export async function getCampaignDraft(actorUserId:string,input:unknown){const access=await accessFor(actorUserId),parsed=campaignDraftExactInput.safeParse(input);if(!parsed.success)throw invalid();const campaign=await readDraftCampaign(parsed.data.campaignId,access);return{campaign,canSave:canSaveCampaignDraft(campaign,access),allowedNextActions:getAllowedCampaignActions(campaign,access)};}
export async function getCampaignCreationReceipt(actorUserId:string,input:unknown){const access=await accessFor(actorUserId),parsed=campaignDraftReceiptInput.safeParse(input);if(!parsed.success)throw invalid();
 const {data,error}=await requireMarketingContentDatabase().from('cardforge_social_campaigns').select('id').eq('contributor_id',access.user.id).eq('creation_idempotency_key',parsed.data.idempotencyKey).maybeSingle();
 if(error)throw new MarketingContentStoreError('Exact Campaign creation identity is unavailable; absence was not established.',503);
 if(data!==null && (!data || typeof data!=='object' || Array.isArray(data) || typeof data.id!=='string'||!campaignDraftExactInput.safeParse({campaignId:data.id}).success))throw new MarketingContentStoreError('Campaign identity receipt is invalid.',503);
 let campaign:MarketingContentPackage|null=null;let suffix='';if(data){try{campaign=await readDraftCampaign(data.id,access);}catch{suffix=' Retained identity was observed, but campaign hydration is unavailable.';}}
 return{campaignId:data?.id??null,campaign,found:Boolean(data),warning:'This actor/key identifies a retained campaign, not a payload fingerprint or proof of newly created content. Absence does not rule out an in-flight operation. Do not replay automatically.'+suffix};
}
export async function getCampaignPlanningContext(actorUserId:string,input:unknown){const access=await accessFor(actorUserId);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw invalid();
 let query=requireMarketingContentDatabase().from('cardforge_marketing_campaigns').select('id,name,audience_key,status,version');if(!access.isOwner)query=query.in('status',['planning','active']);
 const {data,error}=await query.order('updated_at',{ascending:false});if(error||!Array.isArray(data))throw new MarketingContentStoreError('Observed planning campaigns are unavailable; no default or empty fallback was substituted.',503);
 const parsed=campaignPlanningResult.safeParse({campaigns:data.map(row=>({id:row.id,name:row.name,audienceKey:row.audience_key,status:row.status,version:row.version}))});if(!parsed.success)throw new MarketingContentStoreError('Stored planning campaign identity or audience is invalid.',503);return parsed.data;
}
async function mutate(actorUserId:string,input:unknown,save:boolean){
 const access=await accessFor(actorUserId);const parsed=save?campaignDraftSaveInput.safeParse(input):campaignDraftCreateInput.safeParse(input);if(!parsed.success)throw invalid();await consumeCampaignMutationLimit(access.user.id);
 let campaignId:string|null='campaignId'in parsed.data?parsed.data.campaignId:null;let acknowledgedVersion:number|null=null;
 try{if('campaignId'in parsed.data){const ack=await commitSocialCampaignDraftSave({access,campaignId:parsed.data.campaignId,expectedVersion:parsed.data.expectedVersion,input:parsed.data.campaign});campaignId=ack.campaignId;acknowledgedVersion=ack.version;}else{campaignId=(await commitSocialCampaignDraft(access,{...parsed.data.campaign,idempotencyKey:parsed.data.idempotencyKey})).campaignId;}}
 catch(error){if(error instanceof MarketingContentStoreError&&error.status<500)throw error;return{campaignId,campaign:null,canSave:false,receipt:{outcome:'uncertain' as const,committed:null,identityAcknowledged:false,acknowledgedVersion:null,readbackComplete:false,warnings:['Campaign outcome is unconfirmed. Read exact campaign state or the same actor/create-key receipt; do not replay automatically. Matching state is not operation causation.'],retryable:false as const,nextAction:'read' as const}};}
 const warnings:string[]=save?[]:['Native create returned a retained campaign identity. It does not prove a new row was created or changed payload under the same key was saved. Read the retained campaign before editing.'];let campaign:MarketingContentPackage|null=null;
 try{campaign=await readDraftCampaign(campaignId!,access);if(save&&campaign.version!==acknowledgedVersion)warnings.push('Save committed; current version differs from the acknowledged version. Read current state instead of repeating this operation.');}catch{warnings.push('Campaign acknowledgement is retained; independent campaign readback is unavailable.');}
 return{campaignId,campaign,canSave:campaign?canSaveCampaignDraft(campaign,access):false,receipt:{outcome:save?'committed' as const:'identity_acknowledged' as const,committed:save?true:null,identityAcknowledged:true,acknowledgedVersion,readbackComplete:campaign!==null,warnings,retryable:false as const,nextAction:warnings.length?'read' as const:'none' as const}};
}
export const createCampaignDraft=(actorUserId:string,input:unknown)=>mutate(actorUserId,input,false);
export const saveCampaignDraft=(actorUserId:string,input:unknown)=>mutate(actorUserId,input,true);
