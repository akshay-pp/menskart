import 'dotenv/config';
import connectDb from "./db/connectDb.js";
import {app} from "./app.js";



(async () => {
    
    try {

        await connectDb();
        console.log("\nMongo db connection establisehd. waiting for server....");

        app.listen(process.env.PORT, ()=>{
            console.log(`Locked and loaded. Server listening from http://127.0.0.1:${process.env.PORT}`)
        })

    } catch (error) {

        console.error("Error connecting to server");
        console.error(error);
    }

})();