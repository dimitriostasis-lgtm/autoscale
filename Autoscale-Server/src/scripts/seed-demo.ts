import { resetStoreWithSeed } from "../lib/store.js";

const data = await resetStoreWithSeed();

console.log(`Seeded ${data.users.length} users and ${data.influencerModels.length} influencer models.`);