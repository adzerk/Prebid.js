import * as utils from '../src/utils.js';
import { config } from '../src/config.js';
import { registerBidder, getIabSubCategory } from '../src/adapters/bidderFactory.js';
import { BANNER, NATIVE, VIDEO, ADPOD } from '../src/mediaTypes.js';
import { util } from 'chai';

const BIDDER_ENDPOINT = 'http://relay.prebid:8080/openrtb2'

////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////// Request
////////////////////////////////////////////////////////////

const makeSource = (validBidRequest) => {
  const {transactionId, schain} = validBidRequest
  return {
    fd: 1,
    tid: transactionId,
    ext: {
      schain: {
        ver: '1.0',
        complete: 1,
        nodes: (schain || [])
      }
    }
  }
}

const makeImp = (validBidRequest) => {
  const {bidId, params, mediaTypes, adUnitCode} = validBidRequest
  utils.logMessage({trace: 'makeImp', bidId, params})

  const imps = []
  for (const mediaType in mediaTypes) {
    const newImp = {
      id: bidId,
      // TODO where to get this?
      bidfloor: 1,
      tagid: adUnitCode,
      ext: {
        a0x: {
          bidders: params
        }
      }
    }
    const currType = mediaTypes[mediaType]

    const formats = currType.sizes.map(([width, height]) => {
      return {w: width, h: height}
    })

    newImp[mediaType] = {
      format: formats,
      pos: 1, // TODO variable?
      topframe: 1, // TODO variable?
      battr: [] // TODO variable?
    }
    imps.push(newImp)
  }

  return imps
}

const deviceHeuristic = (navigatorPlatformStr) => {
  const deviceTypes = {mobile: 1, pc: 2, phone: 4}
  const match = (str, needle) => {
    return str.indexOf(needle) > -1
  }

  const plat = navigatorPlatformStr.toLowerCase()
  const isPC = (
    match(plat, 'win') ||
    match(plat, 'mac') ||
    match(plat, 'x11') ||
    match(plat, 'linux')
  )
  const isPhone = (
    match(plat, 'iphone') ||
    match(plat, 'android') 
  )

  const type = isPhone && 'phone' ||
               isPC && 'pc' ||
               'mobile'

  return deviceTypes[type]
}

const makeDevice = () => {
  const safeNavigator = (window||{}).navigator || {}
  const platform      = safeNavigator.platform || ''
  const userAgentStr  = safeNavigator.userAgent || ''
  const deviceType    = deviceHeuristic(platform)
  const langauge      = (safeNavigator.languages[1]||'').toUpperCase()
  const jsEnabled     = 1
  return {
    ua: userAgentStr,
    language: langauge,
    devicetype: deviceType,
    js: jsEnabled,
    /*
    geo: {
      country: ?, //ex: US
      lat: ?,
      lon: ?,
      type: 2
    }
    */
  }
}

const makeSite = () => {
  const pubPage   = new URL(config.getConfig('publisherDomain')||'')
  const pubDomain = (pubPage||{}).host
  return {
    id: '0',
    name: 'ISM_9 News - (Creative Approval) - Desktop - ( AU NZ ) (128045)',
    publisher: {
      id: ''
    },
    page: pubPage,
    domain: pubDomain,
    ref: '',
    cat: [
      ''
    ]
  }
}

const makeUser = (validBidRequest, bidderRequest) => {
  utils.logMessage({trace: 'makeUser', validBidRequest})

  // TODO to set the user ids from the UserIds module we need to know the
  // mapping from the Id module. So if the `pbjs.setConfig(...)` has been
  // configured to use FooIdProvider we need to know the location of
  // `validBidRequest.userIds.fooIdProviderKey.fooIdUserKey` to set as the
  // buyeruid.
  // TODO Using the `OpenRTB` EID system seems preferable overall.
  const userIds = {}

  // TODO this will probably come from userSyncs?
  const relayUserId = 'U0nYzMAoJT0AAHH0ZdIAAABZ&9953'

  const newUser = {
    id: relayUserId,
    ext: {
      consent: (bidderRequest.gdprConsent||{}).consentString || '',
      a0x: {
        bidders: userIds
      }
    }
  }
  // Add the (E)xtended User (Id)s. Current server implementation of OpenRT 2.5
  // does not look at this, but it could.
  if (validBidRequest.userIdAsEids) {
    newUser.ext.eids = validBidRequest.userIdAsEids
  }

  return newUser
}

const makeRegs = () => {
  return {
    ext: {
      gdpr: 0
    }
  }
}

const makeExt = () => {
  return {
    ssl: 1
  }
}

const makeBadv = () => {
  return []
}

const makeRelayRequest = (validBidRequest, bidderRequest) => {
  utils.logMessage({trace: 'makeRelayRequest', validBidRequest})

  let defaultRequest = {
    'id': validBidRequest.auctionId,
    'source': makeSource(validBidRequest),
    'imp': makeImp(validBidRequest),
    'badv': makeBadv(),
    'device': makeDevice(),
    'site': makeSite(),
    'user': makeUser(validBidRequest, bidderRequest),
    'regs': makeRegs(),
    'at': 1,
    'ext': makeExt()
  }

  // TODO `params.globalExtFn :: Request -> Request` instead of Object.assign 
  // for deep manipulation?
  defaultRequest = Object.assign(defaultRequest, (validBidRequest.globalExt||{}))
  return defaultRequest;
};


////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////// Response
////////////////////////////////////////////////////////////

const withDefault = (obj, key, defaultValue) => {
  return (obj || {})[key] || defaultValue;
}
const newBidResponse = (bid) => {
  utils.logMessage({trace: 'newBidResponse', bid})
  return {
    // Required fields must be present and contain a reasonable value.
    // <required>
    requestId: bid.impid,
    cpm: bid.price,
    currency: withDefault(bid, 'currency', "USD"),
    width: withDefault(bid, 'w', 300),
    height: withDefault(bid, 'h', 250),
    ad: bid.adm,
    ttl: withDefault(bid, 'ttl', 360),
    creativeId: bid.crid,
    netRevenue: true,
    // </required>
    // dealId: DEAL_ID,
    // mediaType: MEDIA_TYPE,
    // meta: {
      // advertiserDomains: [ARRAY_OF_ADVERTISER_DOMAINS],        
      // advertiserId: ADVERTISER_ID,
      // advertiserName: ADVERTISER_NAME,
      // agencyId: AGENCY_ID,
      // agencyName: AGENCY_NAME,
      // brandId: BRAND_ID,
      // brandName: BRAND_NAME,
      // dchain: DEMAND_CHAIN_OBJECT,
      // demandSource: DEMAND_SOURCE
      // mediaType: MEDIA_TYPE,
      // networkId: NETWORK_ID,
      // networkName: NETWORK_NAME,
      // primaryCatId: IAB_CATEGORY,
      // secondaryCatIds: [ARRAY_OF_IAB_CATEGORIES]
    // }
  };
}
////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////// Spec Interface
////////////////////////////////////////////////////////////


const isBidRequestValid = (bid) => {
  utils.logMessage({trace: 'isBidRequestValid', bid});
  return true;
};

const buildRequests = (validBidRequests, bidderRequest) => {
  utils.logMessage({trace: 'buildRequests', validBidRequests, bidderRequest});
  return validBidRequests.map(
    (validBidRequest) => {
      utils.logMessage({trace: 'buildRequests::map'});
      let reqData = makeRelayRequest(validBidRequest, bidderRequest)
      return {
        method: 'POST',
        url: BIDDER_ENDPOINT,
        data: reqData,
      }
    }
  )
};

const interpretResponse = (serverResponse, request) => {
  utils.logMessage({trace: 'interpretResponse', serverResponse, request});

  const seatBids = ((serverResponse||{}).body||{}).seatbid || [];
  utils.logMessage({seatBids});

  if (!seatBids.length) {
    return [];
  }

  return seatBids.flatMap((seat) => {
    return seat.bid.map((bid) => {
      utils.logMessage({trace: 'interpretResponse::seat.bid::map', bid});
      const bidResponse = newBidResponse(bid);
      utils.logMessage({bidResponse});
      return bidResponse
    })
  })
};

const getUserSyncs = (syncOptions, serverResponses, gdprConsent, uspConsent) => {
  utils.logMessage({trace: 'getUserSyncs'});
};

const onTimeout = (timeoutData) => {
  utils.logMessage({trace: 'onTimeout', timeoutData});
};

const onBidWon = (bid) => {
  utils.logMessage({trace: 'onBidWon'});
};

const onSetTargeting = (bid) => {
  utils.logMessage({trace: 'onSetTargeting'});
};


const BIDDER_CODE = 'relay';
export const spec = {
  code: BIDDER_CODE,
  aliases: ['relay'], // short code
  isBidRequestValid: isBidRequestValid,
  buildRequests: buildRequests,
  interpretResponse: interpretResponse,
  getUserSyncs: getUserSyncs,
  onTimeout: onTimeout,
  onBidWon: onBidWon,
  onSetTargeting: onSetTargeting
}
registerBidder(spec);
