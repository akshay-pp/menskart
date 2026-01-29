export const notLoggedIn = ["&#9995 Hold up! You need to log in before we let you do that. Rules are rules!",
                "&#128527 Whoa there, buddy! Log in first so we know who to blame for this spree.",
                "&#128373 Want to continue? First, prove you’re not just a random lurker. Login required!",
                "&#128526 Login and prove to your wallet who’s boss!",
                "&#129325 You’re just one login away from making your bank account cry happy tears.",
                "&#128110 Not so fast, stranger. Login first, shop later!",
                "&#128129 Ah, trying to skip the login? Nice try, but no. Log in to continue.",
                "&#128373 No free rides here! Log in so we can keep track of your mischief.",
                "&#128131 Login first, then shop till you drop. Or at least till your cart’s full.",
                "&#128110 Trying to sneak past the login screen, are we? Nice try!",
                "&#129393 We love your enthusiasm, but rules are rules—log in before you can dive in.",
                "&#129325 Oh, you thought you could shop without logging in? Cute.",
                "&#129297 You’re just one login away from all your poor financial decisions.",
                "&#129297 You need to log in before we let you blow your budget here.",
                "&#128527 No login, no shopping. That’s how it works around here, Sherlock.",


];



export function serveMessage(messageArray){

    const index =  Math.floor(Math.random() * messageArray.length);
    return messageArray[index];

}