import {Schema, model} from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new Schema(
    {
        fullname: {
            type: String,
            required: [true, "fullname is required"],
            trim: true
        },
        
        email: {
            type: String,
            required: [true, 'email is required'],
            unique: [true],
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: function(){return this.createdWith === "email"},
            minlength: [8, 'minimum 8 characters needed']
        },

        phone: {
            type: String,
            default: ''

        },

        avatar: {
            type: String,
            default: 'default_avatar_url'
        },

        role: {
            type: String,
            default: "user",
            enum: ['user', 'admin']
        },

        isBlocked: {
            type: Boolean,
            default: false
        },

        createdWith: {
            type: String,
            default: "email",
            enum: ["email", "google"]
        }

    },

    {timestamps: true}
)

userSchema.pre("save", async function (next){

    if(!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
})

userSchema.methods.verifyPassword = async function(password){
    return await bcrypt.compare(password, this.password);
}



export const User = model("User", userSchema);