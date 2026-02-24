export const generateInvoiceNumber = (orderItemId) => {
    const now = new Date();
    const date = `${now.getDate()}${now.getMonth()+1}${now.getFullYear()}`;
    const oid = String(orderItemId).slice(-6).toUpperCase();

    return `INV-${date}-${oid}`;
}