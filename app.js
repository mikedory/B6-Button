/**
 * This is a sample lambda function that sends an Email on click of a
 * button. It creates a SNS topic, subscribes an endpoint (EMAIL)
 * to the topic and publishes to the topic.
 *
 * Code originally provided via the AWS IoT Tutorial.
 *
 */

// Update this variable with your email address.
const EMAIL = 'email@domain.com';

/**
 * NOTE: Your function's execution role needs specific permissions for SNS operations.
 * Copy the following policy JSON document below. When you select an execution role for
 * this function, choose "Basic execution role". In the new tab that open, expand "View
 * Policy Document", click Edit, and replace the entire policy document with the copied
 * one. Then, click Allow to create your new execution role.
    {
        "Version" : "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                ],
                "Resource": "arn:aws:logs:*:*:*"
            },
            {
                "Effect": "Allow",
                "Action": [
                    "sns:ListSubscriptionsByTopic",
                    "sns:CreateTopic",
                    "sns:SetTopicAttributes",
                    "sns:Subscribe",
                    "sns:Publish"
                ],
                "Resource": "*"
            }
        ]
    }
 *
 * The following JSON template shows what is sent as the payload:
    {
        "serialNumber": "GXXXXXXXXXXXXXXXXX",
        "batteryVoltage": "xxmV",
        "clickType": "SINGLE" | "DOUBLE" | "LONG"
    }
 *
 * A "LONG" clickType is sent if the first press lasts longer than 1.5 seconds.
 * "SINGLE" and "DOUBLE" clickType payloads are sent for short clicks.
 *
 * For more documentation, follow the link below.
 * http://docs.aws.amazon.com/iot/latest/developerguide/iot-lambda-rule.html
 */

const AWS = require('aws-sdk');
const SNS = new AWS.SNS({ apiVersion: '2010-03-31' });

function findExistingSubscription(topicArn, nextToken, cb) {
    const params = {
        TopicArn: topicArn,
        NextToken: nextToken || null,
    };
    SNS.listSubscriptionsByTopic(params, (err, data) => {
        if (err) {
            console.log('Error listing subscriptions.', err);
            cb(err);
            return;
        }
        const subscription = data.Subscriptions.filter((sub) => sub.Protocol === 'email' && sub.Endpoint === EMAIL)[0];
        if (!subscription) {
            if (!data.NextToken) {
                cb(null, null); // indicate that no subscription was found
            } else {
                findExistingSubscription(topicArn, data.NextToken, cb); // iterate over next token
            }
        } else {
            cb(null, subscription); // a subscription was found
        }
    });
}

/**
 * Subscribe the specified EMAIL to a topic.
 */
function createSubscription(topicArn, cb) {
    // check to see if a subscription already exists
    findExistingSubscription(topicArn, null, (err, res) => {
        if (err) {
            console.log('Error finding existing subscription.', err);
            cb(err);
            return;
        }
        if (!res) {
            // no subscription, create one
            const params = {
                Protocol: 'email',
                TopicArn: topicArn,
                Endpoint: EMAIL,
            };
            SNS.subscribe(params, (err, data) => {
                if (err) {
                    console.log('Error setting up email subscription.', err);
                    cb(err);
                    return;
                }
                // subscription complete
                console.log(`Subscribed ${EMAIL} to ${topicArn}.`);
                cb(null, topicArn);
            });
        } else {
            // subscription already exists, continue
            cb(null, topicArn);
        }
    });
}

/**
 * Create a topic.
 */
function createTopic(topicName, cb) {
    SNS.createTopic({ Name: topicName }, (err, data) => {
        if (err) {
            console.log('Creating topic failed.', err);
            cb(err);
            return;
        }
        const topicArn = data.TopicArn;
        console.log(`Created topic: ${topicArn}`);
        console.log('Creating subscriptions.');
        createSubscription(topicArn, (err, data) => {
            if (err) {
                cb(err);
                return;
            }
            // everything is good
            console.log('Topic setup complete.');
            cb(null, topicArn);
        });
    });
}

exports.handler = (event, context, callback) => {
    console.log('Received event:', event.clickType);
    
    // set the userName
    if (event.clickType === 'SINGLE') {
        userName = 'Rita';
    } else if (event.clickType === 'DOUBLE') {
        userName = 'Mike'
    } else {
        userName = '¯\\_(ツ)_/¯'
    }
    
    // set the date
    timeStamp = new Date();

    messageString = `
Naiya had her B6!
Button was pressed by ${userName} at ${timeStamp}.

---
Serial number:${event.serialNumber} -- processed by Lambda
Click type: ${event.clickType}
Battery voltage: ${event.batteryVoltage}

`

    // create/get topic
    createTopic('aws-iot-button-sns-topic', (err, topicArn) => {
        if (err) {
            callback(err);
            return;
        }
        console.log(`Publishing to topic ${topicArn}`);
        // publish message
        const params = {
            Message: messageString,
            Subject: `B6 Button pressed!`,
            TopicArn: topicArn
        };
        // result will go to function callback
        SNS.publish(params, callback);
    });
};
