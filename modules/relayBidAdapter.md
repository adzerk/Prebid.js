# Overview

```
Module Name: Relay Adapter
Module Type: Bidder Adapter
Maintainer: jgrimes@kevel.com, jswart@kevel.com
```

## Description

The Relay Adapter provides an interface to the Relay Service. The Relay Adapter sends one request to the Relay Service per ad unit, but the Relay Service will then send one request to each configured exchange. This is functionally similar to Prebid Server. One client side request, bids from many exchanges.

The Relay service accepts industry standard OpenRTB 2.5 as its payload. The Relay Adapter converts Prebid.js parameters into an OpenRTB 2.5 request.  We use `ext` data in order to facilitate the "Prebid Server like" behavior.

# Bid Params

|Name|Type|Origin|Location|Description|
|-|-|-|-|-|
|mediaTypes|obj|Prebid|`adUnits[].mediaTypes`|Configures media type and ad sizes.
|params|obj|Prebid|`adUnits[].bids[].params`|Configures the relay bidder itself.

In general `mediaTypes` provides the impression type and size while `params` will be the configuration of the exchange specific sub requests sent from the Relay Service.

Due to the extremely flexible nature of the Relay Bidder it is easiest to see an example configuration which is provided in the following section.

# Example hello_world.html

```html
<!--
  This page calls a single bidder for a single ad slot. It can be considered a "hello world" example for using
  Prebid with the Google Publisher Tag.
  It also makes a good test page for new adapter PR submissions. Simply set your server's Bid Params object in the
  bids array inside the adUnits, and it will use your adapter to load an ad.
  NOTE that many ad servers won't send back an ad if the URL is localhost... so you might need to
  set an alias in your /etc/hosts file so that you can load this page from a different domain.
-->

<html>
<head>
    <!-- Change the following URL to point to your local prebid -->
    <script async src="../../build/dev/prebid.js"></script>
    <script async src="https://www.googletagservices.com/tag/js/gpt.js"></script>
    <script>
        var FAILSAFE_TIMEOUT = 10000;
        var PREBID_TIMEOUT = 10000;

        var adUnits = [{
            code: 'div-gpt-ad-1460505748561-0',
            mediaTypes: {
              banner: {
                // All ad sizes for all `bidder.params` entries are placed here.
                sizes: [[300, 250], [300, 600]],
              }
            },
            bids: [{
              bidder: 'relay',
              params: {
                appnexus: {
                  placementId: 550550
                },
                criteo: {
                  zoneId: 876543
                },
                index: {
                  siteId: "1234567",
                  pmp: {
                    private_auction: 1,
                    deals: [ { id: "ENDEAVOURAU21", bidfloor: 26.52 } ]
                  }
                },
                openx: {
                  unit: "some-unit",
                  delDomain: "some-domain"
                },
                pubmatic: {
                  publisherId: 99999,
                  adSlot: "pubmatic-adslot"
                },
                rubicon: {
                  accountId: 123123,
                  siteId: 333444
                },
                triplelift: {
                  inventoryCode: "triplelife-inventory-code"
                }
              },
              // The `ortb2Imp` key takes a value of OpenRTB request JSON. This
              // value will be applied AFTER prebid.js config `ortb2` and only
              // for this ad unit.
              ortb2Imp: { 
                  test: 1
              },
            }]
        }];

        var pbjs = pbjs || {};
        pbjs.que = pbjs.que || [];

    </script>

    <script>
        var googletag = googletag || {};
        googletag.cmd = googletag.cmd || [];
        googletag.cmd.push(function() {
            googletag.pubads().disableInitialLoad();
        });

        pbjs.que.push(function() {
          pbjs.setConfig({
            // The Relay accountId. This identifies you at the
            // customer/integration level and is static.
            relayAccountId: 12021,

            // Enable iframe syncing. This is disabled by default.
            userSync: {
              filterSettings: {
                iframe: {
                  bidders: ['relay'],
                  filter: 'include'
                }
              }
            },

            /*
              The `ortb2` config key takes a value of OpenRTB request JSON. 
              This value will be merged over the top of the OpenRTB bid request
              sent to Relay. This override will happen for every ad unit. To
              override a single `imp` use `ortb2Imp` on the ad unit, as above.
            */
            ortb2: { 
              user: {
                ext: {
                  a0x: {
                    bidders: {
                      examplebidder: {
                        buyeruid: 'index-user-id'
                      }
                    }
                  }
                }
              }
            }
          })
          pbjs.addAdUnits(adUnits);
          pbjs.requestBids({
            bidsBackHandler: sendAdserverRequest,
            timeout: PREBID_TIMEOUT
          });
        });

        function sendAdserverRequest() {
          if (pbjs.adserverRequestSent) return;
          pbjs.adserverRequestSent = true;
          googletag.cmd.push(function() {
            pbjs.que.push(function() {
              pbjs.setTargetingForGPTAsync();
              googletag.pubads().refresh();
            });
          });
        }

        setTimeout(function() {
          sendAdserverRequest();
        }, FAILSAFE_TIMEOUT);

    </script>

    <script>
        googletag.cmd.push(function () {
            googletag.defineSlot('/19968336/header-bid-tag-0', [[300, 250], [300, 600]], 'div-gpt-ad-1460505748561-0').addService(googletag.pubads());

            googletag.pubads().enableSingleRequest();
            googletag.enableServices();
        });
    </script>
</head>

<body>
<h2>Prebid.js Test</h2>
<h5>Div-1</h5>
<div id='div-gpt-ad-1460505748561-0'>
    <script type='text/javascript'>
        googletag.cmd.push(function() { googletag.display('div-gpt-ad-1460505748561-0'); });
    </script>
</div>
</body>
</html>
```

# Example Request built by the adapter

The following is an example request object that would be generated and sent by the previous *Example hello_world.html*. You can use `ortb2` and `ortb2Imp` to manipulate this request directly. Examples of each of these operations are demonstrated in the above example.

```json
{
  "id": "6c090e87-e0d2-404e-aba9-d7d2c72858b5",
  "source": {
    "fd": 1,
    "tid": "34325db0-7623-47e7-8010-103e573fda7f",
    "ext": {
      "schain": {
        "ver": "1.0",
        "complete": 1,
        "nodes": []
      }
    }
  },
  "imp": [
    {
      "id": "20960d26872ccc",
      "tagid": "div-gpt-ad-1460505748561-0",
      "ext": {
        "a0x": {
          "bidders": {
            "appnexus": {
              "placementId": 550550
            },
            "criteo": {
              "zoneId": 876543
            },
            "index": {
              "siteId": "1234567",
              "pmp": {
                "private_auction": 1,
                "deals": [
                  {
                    "id": "ENDEAVOURAU21",
                    "bidfloor": 26.52
                  }
                ]
              }
            },
            "openx": {
              "unit": "some-unit",
              "delDomain": "some-domain"
            },
            "pubmatic": {
              "publisherId": 99999,
              "adSlot": "pubmatic-adslot"
            },
            "rubicon": {
              "accountId": 123123,
              "siteId": 333444
            },
            "triplelift": {
              "inventoryCode": "triplelife-inventory-code"
            }
          }
        }
      },
      "banner": {
        "format": [
          {
            "w": 300,
            "h": 250
          },
          {
            "w": 300,
            "h": 600
          }
        ]
      }
    }
  ],
  "badv": [],
  "device": {
    "ua": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
    "language": "EN",
    "devicetype": 2,
    "js": 1
  },
  "site": {
    "id": "0",
    "page": "http://localhost:8000/",
    "domain": "localhost:8000"
  },
  "user": {
    "ext": {
      "a0x": {
        "bidders": {
          "index": {
            "buyeruid": "index-user-id"
          }
        }
      }
    }
  },
  "regs": {
    "coppa": 0,
    "ext": {
      "gdpr": 0
    }
  },
  "at": 1,
  "ext": {
    "ssl": 1
  },
  "test": 1
}
```