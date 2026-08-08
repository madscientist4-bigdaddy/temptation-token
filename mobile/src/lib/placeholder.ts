// Tasteful offline fallback — used only when the live API is unreachable so the app
// still demonstrates its real layout instead of an empty error state. Clearly-fictional
// names; no real user data. Vote counts are illustrative.
import type { Profile } from '../api/client'

export const PLACEHOLDER_PROFILES: (Profile & { votes: number })[] = [
  { profileId: 'ph-1', display_name: 'Aurora', image_url: '', link_title: 'View Profile', link_url: 'https://app.temptationtoken.io', votes: 128400 },
  { profileId: 'ph-2', display_name: 'Scarlett', image_url: '', link_title: 'View Profile', link_url: 'https://app.temptationtoken.io', votes: 96250 },
  { profileId: 'ph-3', display_name: 'Nova', image_url: '', link_title: 'View Profile', link_url: 'https://app.temptationtoken.io', votes: 74100 },
  { profileId: 'ph-4', display_name: 'Jade', image_url: '', link_title: 'View Profile', link_url: 'https://app.temptationtoken.io', votes: 51900 },
  { profileId: 'ph-5', display_name: 'Ruby', image_url: '', link_title: 'View Profile', link_url: 'https://app.temptationtoken.io', votes: 33050 },
]
