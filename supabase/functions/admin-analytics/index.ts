import { createAnalyticsApp } from '../_shared/analytics-app.ts';
import { analyticsDependencies } from '../_shared/analytics-runtime.ts';
Deno.serve(createAnalyticsApp('admin', analyticsDependencies()));
