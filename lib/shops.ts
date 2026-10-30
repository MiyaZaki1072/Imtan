import 'server-only';

import { cache } from 'react';
import { loadShopBySlug } from './menu/db';
import { createAdminClient } from './supabase/admin';

/** A shop's menu, prices and stats from the database, once per request. */
export const getShopFromDb = cache((slug: string) => loadShopBySlug(createAdminClient(), slug));
