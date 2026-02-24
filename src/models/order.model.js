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

    subtotal: {
        type: Number
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
        enum: [
            'none',
            'requested',
            'approved',
            'rejected',
            'refunded'
        ],
        default: 'none'
    },

    returnReason: { type: String },

    refundInfo: {
        refundedAmount: { 
            type: Number,
            default: 0
        },
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

    pricing: {
        itemsTotal: {
            type: Number,
            required: true,
            default: 0
        },

        discount: {
            type: Number,
            default: 0
        },

        shipping: {
            type: Number,
            default: 0
        },

        tax: {
            type: Number,
            default: 0
        },

        grandTotal: {
            type: Number,
            required: true,
            default: 0
        }
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
    },

    offerInfo: {
        offerId: {
            type: Schema.Types.ObjectId,
            ref: "Offer"
        },
        discount: {
            type: Number
        }
    }

}, {timestamps : true})


orderItemSchema.pre('save', function(next) {
    this.subtotal = this.price * this.quantity;
    next();
});


orderSchema.pre("save", function(next) {
    //obsolete but needed
    let totalPrice = this.orderItems.reduce((total, item) => total + (item.price * item.quantity), 0);
    this.totalPrice = totalPrice;

    let itemsTotal = this.orderItems.reduce((total, item) => total+item.subtotal, 0);
    this.pricing.itemsTotal = itemsTotal;

    if(this.couponInfo && typeof this.couponInfo.discount === 'number'){
        this.pricing.discount = this.couponInfo.discount;
        this.grandTotal = itemsTotal - this.couponInfo.discount - this.pricing.shipping - this.pricing.tax;
        this.totalPrice = itemsTotal - this.couponInfo.discount - this.pricing.shipping - this.pricing.tax;

    } else if (this.offerInfo && typeof this.offerInfo.discount === 'number') {
        this.pricing.discount = this.offerInfo.discount;
        this.grandTotal = itemsTotal - this.offerInfo.discount - this.pricing.shipping - this.pricing.tax;
        this.totalPrice = itemsTotal - this.offerInfo.discount - this.pricing.shipping - this.pricing.tax;

    } else {
        this.grandTotal = itemsTotal - this.pricing.shipping - this.pricing.tax;
        this.totalPrice = itemsTotal - this.pricing.shipping - this.pricing.tax;
    }

    next();
})

export const Order = model("Order", orderSchema);