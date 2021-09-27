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
  const {transactionId} = validBidRequest
  return {
    'fd': 1,
    'tid': transactionId,
    'ext': {
      'schain': {
        'ver': '1.0',
        'complete': 1,
        'nodes': [
          {
            'asi': 'inskinmedia.com',
            'sid': '971672',
            'hp': 1
          }
        ]
      }
    }
  }
}

const makeImp = (validBidRequest) => {
  const {bidId, params} = validBidRequest
  utils.logMessage({trace: 'makeImp', bidId, params})
  return [{
    'id': bidId,
    'instl': 0,
    'banner': {
      'w': 980,
      'h': 300,
      'pos': 1,
      'topframe': 1,
      'battr': []
    },
    'bidfloor': 26.52,
    'tagid': 'ad',
    'ext': {
      'a0x': {
        'bidders': params
      }
    }
  }]
}

const makeDevice = () => {
  return {
    'language': 'EN',
    'devicetype': 2,
    'geo': {
      'country': 'AU',
      'lat': -27.6265,
      'lon': 153.3003,
      'type': 2
    },
    'ip': '101.179.3.237',
    'ua': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.182 Safari/537.36',
    'js': 0,
    'make': 'Google',
    'model': 'Chrome',
    'os': 'Desktop',
    'osv': ''
  }
}

const makeSite = () => {
  return {
    'id': '0',
    'name': 'ISM_9 News - (Creative Approval) - Desktop - ( AU NZ ) (128045)',
    'publisher': {
      'id': ''
    },
    'page': 'https://www.9news.com.au/',
    'domain': 'www.9news.com.au',
    'ref': '',
    'cat': [
      ''
    ]
  }
}

const makeUser = (validBidRequest) => {
  utils.logMessage({trace: 'makeUser', validBidRequest})

  // foreach bidder in params
    // lookup the user via the userId module

  const baseUser = {
    // TODO what is this id?
    id: 'U0nYzMAoJT0AAHH0ZdIAAABZ&9953',
    ext: {
      consent: 'example_consent_string',
      a0x: {
        bidders: {
          index: {
            buyeruid: 'U0nYzMAoJT0AAHH0ZdIAAABZ&9953'
          },
          magnite: {
            buyeruid: 'magnite-test-buyeruid'
          }
        }
      }
    }
  }
  // Add the (E)xtended User (Id)s. Current server implementation of OpenRT 2.5
  // does not look at this, but it could.
  if (validBidRequest.userIdAsEids) {
    baseUser.ext.eids = validBidRequest.userIdAsEids
  }

  return baseUser
}

const makeRegs = () => {
  return {
    'ext': {
      'gdpr': 0
    }
  }
}

const makeExt = () => {
  return {
    'ssl': 1
  }
}

const makeBadv = () => {
  return []
}

const makeRelayRequest = (validBidRequest) => {
  utils.logMessage({trace: 'makeRelayRequest', validBidRequest})
  const defaultReqeust = {
    'id': validBidRequest.auctionId,
    'source': makeSource(validBidRequest),
    'imp': makeImp(validBidRequest),
    'badv': makeBadv(),
    'device': makeDevice(),
    'site': makeSite(),
    'user': makeUser(validBidRequest),
    'regs': makeRegs(),
    'at': 1,
    'test': 1,
    'ext': makeExt()
  }
  return defaultReqeust;
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

  const requestObjects = [];
  for (let validBidRequest of validBidRequests) {
    utils.logMessage({trace: 'buildRequests::for'});
    let reqData = makeRelayRequest(validBidRequest)
    let requestObj = {
      method: 'POST',
      url: BIDDER_ENDPOINT,
      data: reqData,
    }
    requestObjects.push(requestObj);
  }

  return requestObjects;
};

const interpretResponse = (serverResponse, request) => {
  utils.logMessage({trace: 'interpretResponse', serverResponse, request});
  const seatBids = ((serverResponse||{}).body||{}).seatbid || [];
  utils.logMessage({seatBids});
  const bidResponses = [];
  if (!seatBids.length) {
    return bidResponses;
  }
  for (let seat of seatBids) {
    for (let bid of seat.bid) {
      utils.logMessage({trace: 'interpreResponse::for::for', bid});
      const bidResponse = newBidResponse(bid);
      utils.logMessage({bidResponse});
      bidResponses.push(bidResponse);
    }
  }
  return bidResponses;
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
