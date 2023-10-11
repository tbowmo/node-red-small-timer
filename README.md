[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=tbowmo_node-red-small-timer&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=tbowmo_node-red-small-timer)
![Sonar cloud test](https://github.com/tbowmo/node-red-small-timer/actions/workflows/sonarcloud.yml/badge.svg)
![Build status](https://github.com/tbowmo/node-red-small-timer/actions/workflows/node-builds.yml/badge.svg)

# Node-red-small-timer

A node-RED timer node to rule them all.

# Install

Within your local installation of Node-RED run:

`npm install @tbowmo/node-red-small-timer`

Once installed, restart your node-red server, and you will have a set of new nodes available in your palette under timers:

# Node-RED SmallTimer

This node is what all the fuzz is about, it injects either an `on` or `off` message at set times. These can either be at the same time every day, say '19:00' for on, and '23:00' for off, if you want to have a porch light turned on. But the real strength here is that you can have it turn on the light at _sunset_ and off at _dusk_, now isn't that cool?

This is the key idea about the small timer, you can get it to do exactly that, turn on a light at sunset, and off again at dusk.

# Setup

![image of configuration](images/small-timer-config.png)

Start by configuring a position for your node to do sunrise/sunset etc. calculation for. this doesn't need to be super exact, you can use google maps to figure out the latitude / longitude for your site.

## Option checkboxes
The **repeat** and **inject on startup** checkboxes configures the node to either repeat the output every minute (default is that it only emits a message on state change), and if you want to inject a message upon startup / redeploy of your node red flow. 

**Wrap midnight** will wrap on time around midnight, if on time is 23:00 and off time is 02:00, checking this will turn on before midnight, and off after. If unchecked, it will ignore this. Say, you have a fixed on time at 06:00 in the morning, and a dynamic off time tracking sunrise. When the sunrise is before 06:00 you do not want it to turn on the porch light, you might not want to have the light turned on.

**Debug enable** this will add an extra output to the node providing debug information, like the different sunrise/sunset etc. times (see [debug section below](#debug))

## On and Off time
Configure the on and off events

### Time of day
Set this propperty to the desired on / off time for the day. Can be a specific time, or use a dynamic time such as _sunrise_, _sunset_ etc.

### Offset
In case of using a dynamic time, this can be used to add an offset to the calculated time. Use it for example to turn the light on 30 minutes before sunrise.

### Override timeout
Used when triggering an override of the current state, after set time the node will switch back to whatever the output state should be at the given time, if it was in auto mode. This value is split into an on and off timeout. This means that you could have an 5 minutes on timeout (for turning on lights momentarily) while keeping off at default timeout which is 24 hours (or until next state change)

### Minimum time
This can be used to set an minimum required on time, if the calculated ontime is below this value it is ignored. For example you might not be interested to turn on the light for only 5 minutes, when you are using sunset to turn on lights in the evening. Then you can set this property to the minimum required on time

## Topic
Topic parameter of the msg that is sent out on events. This can be used to send on to mqtt for example.

## On message
Payload of the output message is set to this value during on, can be set to json, number, string, or boolean

## Off message
Payload of the output message is set to this value during off, can be set to json, number, string, or boolean

## Rules
This can be used to configure what days the rule should / should not run. 

**==** is include, this specifies days where the rule should run

**<>** is exclude, this specifies days where the rule does _not_ run.

Note that if the state is turned on by auto state, it will also run at the off time, even if the day is excluded.

The rules is read and executed one by one, it is the outcome after the last rule has been read, that defines if the day is included or excluded

# Output

By default the node has a single output, which provides the following object: 
```ts
{
    trigger: 'input' | 'timer',
    autoState: boolean,
    timeout: number,
    temporaryManual: boolean,
    duration: number,
    stamp: number,
    state: string,
    payload: object, string, number // as setup in the node
    topic: string // (as setup in the node)
}

```

| property | description |
|----------|-------------|
| trigger  | if the output is triggered by an input message, then this property is set to "input" otherwise it is set to "timer"|
| autoState|will be true whenever the node is running in auto mode
|timeout | indicates how long there is until the node will return to auto state, when in temporary override|
|temporaryManual| Will be true when the node is in temporary override|
|duration| time until next on, or off, event happens|
|state| will be one of auto, tempOn or tempOff|
|stamp| current unix timestamp (since epoch)|

# Input

The input of the node takes a few commands in the payload property og the message sent _to_ small timer, these are completely optional and not needed for normal operation, but can be used to do temporary on / off etc.

| payload | description |
|---------|-------------|
| 1 / on|Turns the output temporarily on|
| 0 / off|Turns the output temporarily off|
|auto / default|Sets the node back to autostate, and outputs whatever the autostate would be (on/off)|
|sync|Emits the current state on the output|

Using the temporary on/off, will emit the respective on/off message on the output (and repeat it every minute, if so requested), at the same time it will start an internal countdown with the values for temporary override set in the node, and when the countdown reaches 0 it will resume auto mode.

Note that if you do a temporary on / off to the same state that the automode will be in, then the node will return to auto state!

Sending the auto (or default) to small timer, will cause it to return to automode (if it was in a temporary on/off state earlier).

**NOTE!** if the input payload property contains non decodable properties / strings, the input will be ignored, and an error will be emitted to Node-Red

## Optional properties on input message
| property |   type  |description |
|----------|---------|------------|
| reset    | boolean |If this property resolves to a truthy value, the node will be reset to auto mode
| timeout  | number  |This can be used to override the timeout set in the configuration, and applies to the current on or off command. If left out / undefined, the configured timeout will be used

# Debug

When debug is enabled, the node will have a secondary output, which emits data from the suncalc calculations for sunrise/sunset etc. This data will be emitted at the same time as the main output is emitted (at changes, or when sync is sent to the input)

The debug output will contain the following data
```ts
{
    override: 'tempOn' | 'tempOff' | 'auto',
    topic: 'debug'
    sunTimes: {
        dawn: number,
        dusk: number,
        solarNoon: number,
        sunrise: number,
        sunset: number,
        night: number,
        nightEnd: number,
    },
    moonTimes: {
        rise: number,
        set: number,
    },
    now: number,
    actualStart: number,
    actualEnd: number,
    nextStart: number,
    nextEnd: number,
    onState: boolean,
    operationToday: 'normal' | 'noMidnightWrap' | 'minimumOnTimeNotMet',
}
```
All the above numbers will be number of minutes since midnight on the day the event happens, except nextStart and nextEnd, which will be the number of minutes until the next event.

The debug object can be extended with new properties in future releases that might not be described fully here.
