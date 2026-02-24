export const recalculateOrderStatus = (orderItems) => {

    const totalItemsCount = orderItems.length;
    let orderStatus, returnStatus;
    const shippedItemsCount = orderItems.filter(item => item.status === "shipped").length; 
    const deliveredItemsCount = orderItems.filter(item => item.status === "delivered").length;
    const cancelledItemsCount = orderItems.filter(item => item.status === "cancelled").length;
    const returnedItemsCount = orderItems.filter(item => item.returnStatus === "refunded").length;

    const counts = {
        shipped: shippedItemsCount,
        delivered: deliveredItemsCount,
        cancelled: cancelledItemsCount
    };

    if (returnedItemsCount === totalItemsCount) {
        returnStatus = "returned";
    }

    for (const item in counts) {
        if (counts[item] === totalItemsCount){
            orderStatus = item;
        }
    }


}