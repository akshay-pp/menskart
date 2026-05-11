import { Order } from "../models/order.model.js";



export const getOrderDetails = async(req, res) => {
    const {orderId, itemId} = req.params;
    const order = await Order.findById(orderId).populate('product', 'productname price')
    const item = order.orderItems.id(itemId)
}