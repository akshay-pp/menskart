import { Address } from "../models/address.model.js";
import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { Wallet } from "../models/wallet.model.js";
import { PAGINATION_CONFIG } from "../utils/constants/config.js";
import { STATUS_CODES } from "../utils/constants/statusCodes.js";
import { formatDate } from "../utils/formatDate.js";
import { sendOtp } from "../utils/nodemailer.js";


// load different profile tabs 
export const getProfile = async (req,res) => {

        const tab = req.params.tab || "dashboard";
        let data = {};

        try {

            if (tab === "address") {
                data.address = await Address.find({owner: req.session.user._id})
            }

            if (tab === "orders"){
                
                const page = parseInt(req.query.page) || 1;
                const limit = PAGINATION_CONFIG.DEFAULT_LIMIT;
                const skip = (page-1) * limit;

                const totalDocs = await Order.countDocuments({
                    owner: req.session.user._id,
                    $nor: [{
                        'paymentInfo.mode': 'razorpay',
                        'paymentInfo.status': {$in: ['pending', 'failed']}
                    }]
                });

                const orders = await Order.aggregate ([
                    
                    {$match:{
                        owner: req.session.user._id,
                        $nor: [{
                            'paymentInfo.mode': 'razorpay',
                            'paymentInfo.status': {$in: ['pending', 'failed']}
                        }]
                    }},
                    {$sort: {createdAt: -1}},
                    {$unwind: "$orderItems"},
                    {$sort: {createdAt: -1}},
                    {$lookup: {
                        from: "products",
                        localField: "orderItems.product",
                        foreignField: "_id",
                        as: "orderItems.productData"
                    }},
                    {$unwind: "$orderItems.productData"},
                    {$skip: skip},
                    {$limit: limit}
    
                ]);

                const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
                const pendingOrders = await Order.aggregate ([
                    
                    {$match:{
                        owner: req.session.user._id,
                        'paymentInfo.mode': 'razorpay',
                        'paymentInfo.status': {$in: ['pending', 'failed']},
                        createdAt: {$gte: fifteenMinutesAgo}
                    }},
                    {$sort: {createdAt: -1}},
                    {$unwind: "$orderItems"},
                    {$sort: {createdAt: -1}},
                    {$lookup: {
                        from: "products",
                        localField: "orderItems.product",
                        foreignField: "_id",
                        as: "orderItems.productData"
                    }},
                    {$unwind: "$orderItems.productData"},
                    {$limit: 2}
    
                ]);

                console.log(pendingOrders);

                const totalPages = Math.ceil(totalDocs/limit);
    
                data.page = page;
                data.totalDocs = totalDocs;
                data.totalPages = totalPages;
                data.orders = orders;
                data.pendingOrders = pendingOrders || [];
                
            };

            if (tab === "wallet") {
                const wallet = await Wallet.findOneAndUpdate(
                    {owner: req.session.user._id},
                    {$setOnInsert: {balance: 0, transactions: []}},
                    {new: true, upsert: true}
                ).lean();

                const walletUiData = {
                    Credit: {
                        badgeClass: "bg-secondary",
                        amountPrefix: `+ ₹`,
                        amountClass: 'text-success',
                        sources: {
                            refund: 'Refund for: ',
                            referral: 'Referal reward'
                        }
                    },

                    Debit: {
                        badgeClass: "bg-danger",
                        amountPrefix: `- ₹`,
                        amountClass: 'text-danger',
                        sources: 'Paid for order'
                    }
                };

                wallet.transactions?.forEach(item => {
                    const ui = walletUiData[item.direction];
                    item.badgeClass = ui.badgeClass;
                    item.date = formatDate(item.createdAt);
                    item.amountText = `${ui.amountPrefix}${item.amount}`;
                    item.amountClass = ui.amountClass;
                    item.description = typeof ui.sources === 'object' ? ui.sources[item.source] : ui.sources;
                });

                wallet.transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                data.wallet = wallet;
            };
            console.log(data);
            return res.status(STATUS_CODES.SUCCESS).render("profile", {activeTab: tab, ...data });
        
        } catch (error) {
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
        }

};



//-------------------- edit profile ------------------------//

//edit profile name
export const editProfileName = async (req, res) => {

    console.log(req.body);

    if(req.session?.user){

        try {
            
            const user = await User.findByIdAndUpdate(req.session.user._id, {fullname: req.body.updatedFullName} , {new:true});
            req.session.user.fullname = req.body.updatedFullName;
            console.log(user);
            return res.status(200).json({success: true, message: "Name updated successfully", firstname: user.fullname.split(" ")[0], lastname: user.fullname.split(" ")[1]});

        
        } catch (error) {
            return res.status(500).json({success: false, error: error.message});
        }


    }else{
        return res.redirect("/");
    }

};


//edit phone
export const editPhone = async (req, res) => {

    console.log(req.body);

    if(req.session?.user){

        try {
            
            const user = await User.findByIdAndUpdate(req.session.user._id, {phone: req.body.updatedPhone} , {new:true});
            req.session.user.phone = req.body.updatedPhone;
            console.log(user);
            res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Phone Number updated successfully", phone: user.phone});

        
        } catch (error) {
            res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
        }


    }else{
        return res.redirect("/");
    }

};


//edit email
export const editEmail = async (req, res) => {

    console.log(req.body);

    if(req.session?.user){

        try {
            
            const oldOtp = await sendOtp(req.session.user.email);
            const newOtp = await sendOtp(req.body.updatedEmail);
            const expiry = Date.now()+(60*1000);
            req.session.oldOtp = oldOtp;
            req.session.newOtp = newOtp;
            req.session.otpExpiry = expiry;
            req.session.updatedEmail = req.body.updatedEmail;

            console.log(req.session.oldOtp, req.session.newOtp);
            res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Otp sent successfully to both emails"});

        
        } catch (error) {
            console.log(error);
            res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
        }


    }else{
        return res.redirect("/");
    }

};


//confirm email
export const confirmEmail = async (req, res) => {

    console.log(req.body);

    if(req.session?.user){
        
        if (!req.session.updatedEmail){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "unauthorized"});
        }
    
        if (req.session.otpExpiry < Date.now()){
            return res.status(STATUS_CODES.BAD_REQUEST).json({success: false, error: "otp expired"});
        }
    
        if(req.session.oldOtp == req.body.oldOtp && req.session.newOtp == req.body.newOtp){
    
            try {
                
                const user = await User.findByIdAndUpdate(req.session.user._id, {email: req.session.updatedEmail}, {new:true});
                req.session.user.email = req.session.updatedEmail;
                console.log(user);
                return res.status(STATUS_CODES.SUCCESS).json({success: true, message: "Email updated successfully", email:user.email});
    
            
            } catch (error) {
                console.log(error);
                return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
            }
    
        }

    }else{
        return res.redirect("/");
    }

};



//------------------- address operations -------------------------//

//add address
export const addAddress = async (req,res) => {

    console.log(req.body);
    
    if(!req.session.user){
        return res.redirect("/");
    }

    try {

        const newAddress = new Address({
            owner : req.session.user._id,
            name : req.body.addressName,
            phone : req.body.addressPhone,
            pincode : req.body.addressPincode,
            address : req.body.addressTextarea,
            city : req.body.addressCity,
            type : req.body.addressType,
            state : req.body.addressState
        });
    
        await newAddress.save();

        console.log(newAddress);
        return res.status(STATUS_CODES.SUCCESS).json({success:true, message: "New address added successfully", address: newAddress})

    } catch (error) {

        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});

    }

};


//delete address
export const deleteAddress = async (req,res) => {
    
    if(req.session.user){

        const {addressId} = req.params;
        try {

            await Address.findByIdAndDelete(addressId);
            return res.redirect("/api/user/profile");
        
        } catch (error) {
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success:false, error: error.message});
        }

    }else{
        return res.redirect("/");
    }

};



//edit address
export const editAddress = async (req,res) => {

    if(req.session.user){

        try {
            
            /////validation pending
            const address = await Address.findById(req.body.editAddressId);
            address.name = req.body.editAddressName;
            address.phone = req.body.editAddressPhone;
            address.pincode = req.body.editAddressPincode;
            address.address = req.body.editAddressTextarea;
            address.city = req.body.editAddressCity;
            address.type = req.body.editAddressType;
            address.state = req.body.editAddressState;
            await address.save();
            return res.status(STATUS_CODES.SUCCESS).json({success:true, message: "Address updated successfully", address});

        } catch (error) {
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success: false, error: error.message});
        }
    }else{
        return res.redirect("/");
    }
}

//--------------------------------------------//






