import { getCurrentBrowserFingerPrint } from "@rajesh896/broprint.js";

getCurrentBrowserFingerPrint().then((fingerprint) => {
    // fingerprint is your unique browser id.
    // This is well tested

    // the result you receive here is the combination of Canvas fingerprint and audio fingerprint.
    console.log(fingerprint)
})