import { createUserDataApp } from '../_shared/user-data-app.ts';
import { userDataDependencies } from '../_shared/user-data-runtime.ts';
Deno.serve(createUserDataApp('admission',userDataDependencies()).fetch);
