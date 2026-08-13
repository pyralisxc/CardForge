import { FieldHelp } from '@/features/developer-assets/components/DeveloperAssetHubUi';
import { DecisionCard } from '@/features/developer-assets/components/OwnerDeveloperProgramControls';
import { estimateDeveloperAssetStorage, type DeveloperProgramSettings } from '@/features/developer-assets/lib/developerAssets';

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** exponent;
  return `${amount >= 10 || exponent === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[exponent]}`;
};

export function OwnerAssetStorageForecast({
  settings,
  activeDeveloperCount,
}: {
  settings: DeveloperProgramSettings;
  activeDeveloperCount: number;
}) {
  const forecast = estimateDeveloperAssetStorage(settings, activeDeveloperCount);

  return (
    <div className="mt-5 border border-[#5f4526] bg-[#100c08] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-serif text-xl text-[#fff1c7]">Asset storage forecast</h3>
          <p className="mt-2 text-sm leading-6 text-[#c7b288]">
            Estimate managed asset storage if published slots, one month of voting submissions, and visible archive capacity are all full.
          </p>
        </div>
        <FieldHelp text="This is planning math, not a billing meter. Actual files should live in object storage; database rows store metadata and source pointers." />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <DecisionCard label="Publish slots" body={`${forecast.publishSlotCount} slots / ${formatBytes(forecast.estimatedPublishedBytes)} estimated`} />
        <DecisionCard label="Voting month" body={`${forecast.monthlyVotingSlotCount} possible uploads / ${formatBytes(forecast.estimatedMonthlyVotingBytes)}`} />
        <DecisionCard label="Archive reserve" body={`${forecast.archiveSlotCount} visible archived assets / ${formatBytes(forecast.estimatedArchiveBytes)}`} />
        <DecisionCard label="Max managed" body={`${formatBytes(forecast.estimatedMaximumManagedBytes)} at current settings`} />
      </div>
      <p className="mt-3 text-xs leading-5 text-[#a98a55]">
        Average estimate: {formatBytes(forecast.averageAssetBytes)} per asset. Largest default estimate: {formatBytes(forecast.largestEstimatedAssetBytes)}.
      </p>
    </div>
  );
}
