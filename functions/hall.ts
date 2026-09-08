import { createHallBackend } from '../backend/hall';
let backend: ReturnType<typeof createHallBackend>;
function handle(request: Request) { backend ??= createHallBackend(); return backend.handle(request); }
// One explicit endpoint. Neither the private profiles nor admin sessions are
// mounted as generic omg.dev CRUD collections or realtime subscriptions.
export const GET = handle;
export const POST = handle;
