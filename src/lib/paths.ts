// A table's menu, the page a diner's QR code opens (its cart is under it, at
// `/cart`). Also what the return-to-table flow stores, so built in one place.
export const tablePath = (shopId: string, tableId: string) => `/shops/${shopId}/tables/${tableId}`;
