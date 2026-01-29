import {Schema, model} from "mongoose";

const orderItemSchema = new Schema({
    
    product: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },

    price: {
        type: Number,
        required: true
    },
    
    quantity: {
        type: Number,
        default: 1,
        required: true
    },

    status: {
        type: String,
        enum: [
            "created", 
            "confirmed", 
            "processing", 
            "shipped", 
            "delivered", 
            "cancelled"
        ],
        default: "created",
        required: true
    },

    deliveredAt: {
        type: Date
    },

    returnStatus: {
        type: String,
        enum: ['none', 'requested', 'approved', 'rejected', 'refunded'],
        default: 'none'
    },

    refundedAmount: { 
        type: Number,
        default: 0
    },

    refundInfo: {
        refundPaymentId: { type: String },
        refundReason: { type: String },
        refundedAt: { type: Date }
    }

}, {timestamps: true});



const orderSchema = new Schema({

    owner : {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    orderItems : [orderItemSchema],

    totalPrice: {
        type: Number,
        required: true,
        default: 0
    },

    discountedPrice: {
        type: Number,
        default: 0
    },

    paymentInfo : {

        type : {

            status: {

                type: String,
                enum: ["pending", "completed", "failed", "refunded"],
                required: true

            },

            mode: {

                type: String,
                enum: ["razorpay", "cash-on-delivery", "wallet"],
                required: true

            },

            razorpayInfo : {
                
                type: {
                    razorpayOrderId: "string",
                    razorpayPaymentId: "string",
                    razorpaySignature: "string"
                },

                required: function () {
                    return this.paymentInfo?.mode === "razorpay"
                },

                default: {}

            }

        },

        required: true
    },

    orderStatus: {
        type: String,
        enum: [
            "created", 
            "confirmed", 
            "processing", 
            "shipped", 
            "delivered", 
            "cancelled"
        ],
        default: "created",
        required: true
    },

    deliveredAt: {
        type: Date
    },

    returnStatus: {
        type: String,
        enum: ['none', 'requested', 'approved', 'rejected', 'refunded'],
        default: 'none'
    },

    address: {
        type: Schema.Types.ObjectId,
        ref: "Address",
        required: true 
    },

    couponInfo: {
        couponId: {
            type: Schema.Types.ObjectId,
            ref: "Coupon"
        },
        couponCode: {
            type: String
        },
        discount: {
            type: Number
        }
    }

}, {timestamps : true})


orderSchema.pre("save", function(next) {

    this.totalPrice = this.orderItems.reduce((total, item) => total + (item.price * item.quantity),0);

    if(this.couponInfo && typeof this.couponInfo.discount === 'number'){
        this.totalPrice = this.orderItems.reduce((total, item) => total + (item.price * item.quantity), 0) - this.couponInfo.discount;
    } else {
        this.totalPrice = this.orderItems.reduce((total, item) => total + (item.price * item.quantity),0);
    }
    
    next();

})

export const Order = model("Order", orderSchema);