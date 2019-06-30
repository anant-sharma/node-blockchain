/**
 * This file contains the common utils
 */
import { v4 as uuidv4 } from 'uuid';

export function generateUUID() {
    return uuidv4();
}

export function delay(time = 1000) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, time);
    });
}
