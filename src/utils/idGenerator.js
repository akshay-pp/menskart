import {nanoid} from "nanoid";

export const generateInvoiceNumber = (orderItemId) => {
    const now = new Date();
    const date = `${now.getDate()}${now.getMonth()+1}${now.getFullYear()}`;
    const oid = String(orderItemId).slice(-6).toUpperCase();

    return `INV-${date}-${oid}`;
};


export const generateOrderId = () => {
    return `ORD-${nanoid(12)}`;
}

export const generateCheckoutSessionId = () => {
    return `CHK-${nanoid(12)}`;
}

export const generateReferralCode = (userName) => {
    const namePart = userName.slice(0, 4).toUpperCase();
    const numberPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${namePart}${numberPart}`;
}