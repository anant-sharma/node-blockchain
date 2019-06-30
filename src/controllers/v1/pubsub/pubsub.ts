/**
 * This file contains the code required to
 * setup pubsub methods
 */
import { MQ } from '../../../common/mq';
import { mqConfig } from '../../../config/config';

export class PubSub {
    public static init() {
        // Establish Connection with MQ
        MQ.connect(mqConfig.url);

        // Create Channel
        MQ.createChannel();

        // Create Exchange
        MQ.createExchange(this.exchange);
    }

    public static publish(data: string) {
        MQ.publish(this.exchange, '', data);
    }

    public static subscribe(queue: string, onMessage: any) {
        MQ.establishWorker(queue, onMessage, {
            noAck: true,
        });
    }

    private static exchange = 'bc.service.bus';
}
