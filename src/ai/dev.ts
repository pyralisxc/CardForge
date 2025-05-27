
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-card-text.ts';
import '@/ai/flows/suggest-card-layout.ts';
import '@/ai/flows/generate-card-image.ts'; 
import '@/ai/flows/suggest-template-colors.ts'; // New flow for color suggestions
    
