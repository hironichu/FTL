# <center>FTL </center>

FTL (Faster Than Light) is a non standard WebRTC implementation for Deno.

---
## <center>DISCLAMER</center>

```
Please note that this being Non standard means that using it will have drawbacks to normal WebRTC. it is made for fast communication and mostly testing purposes.
```
----

As of today there hasn't been any working WebRTC library for Deno, this is a first attempt at making one that is fast unreliable and usable.

---
## <center>Usage: </center>

(WIP...)

---
Quick FAQ (Frequently Asked Questions):

1. "Unreliable?" : Yes, it uses the standard RTCP option `unreliable` in order to send messages that are not fragmented, each packet has a maximum ammount of 1256 bytes (could go higher but optimal), and packet that gets dropped are not sent again, thus the tag unreliable.

2. "Non standard?": This library does not include 90% of the WebRTC api, only the bare mimimum, "DataChannel". This is because re-implementing it is a big nono.



