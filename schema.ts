import { defineSchema, collection, fields } from '@omg-dev/schema';
// Marks this as a persistent omg.dev database application. The actual hall
// tables are private SQL tables owned by backend/hall.ts, never generic CRUD
// collections or realtime subscriptions. This marker is user-scoped.
export default defineSchema({
  collections: {
    runtime_marker: collection({ fields: { value: fields.string() } }).scoped('user')
  }
});
