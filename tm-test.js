import { getFingerprint } from '@thumbmarkjs/thumbmarkjs'

getFingerprint()
    .then(result => {
        console.log("tm", result);
    })
    .catch((error) => {
        console.error('Error getting fingerprint:', error);
    });