import { createPushHandler } from "../_shared/push/app.ts";
import { pushDependencies } from "../_shared/push/runtime.ts";
Deno.serve(createPushHandler("dispatch", pushDependencies()));
