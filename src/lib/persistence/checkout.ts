/**
 * Persistência sob Spark: helpers de domínio sem Cloud Functions.
 * firestoreDb permanece o adapter; estes módulos concentram invariants hot-path.
 */
export { fulfillCheckoutPaid } from "@/features/billing/subscriptions";
