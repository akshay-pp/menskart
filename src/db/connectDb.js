import mongoose from "mongoose";

const connectDb = async() => {
   
    try {

        const mongo = await mongoose.connect(`${process.env.MONGO_URI}/${process.env.DATABASE_NAME}`);
        return mongo;
    
    } catch (error) {

        console.log(`mongodb atlas conneciton failed. ${error}`);
        process.exit(1);
        
    }
}

export default connectDb;
