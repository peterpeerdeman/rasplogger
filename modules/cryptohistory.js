const fetch = require('node-fetch');
const cheerio = require('cheerio');

const writeInflux = (influxClient, cryptoDays, coin) => {
    let influxWrites = cryptoDays.map(function (day) {
        const { date, ...fields } = day;
        return new Promise((resolve) => {
            influxClient
                .write('prices')
                .tag({
                    currency: 'eur',
                    crypto: coin,
                })
                .field(fields)
                .time(date * 1000 * 1000 * 1000)
                .queue();
            resolve();
        });
    });
    Promise.all(influxWrites).then(() => {
        influxClient
            .syncWrite()
            .then(() =>
                console.debug(
                    `${Date.now()} cryptohistory: sync write ${coin} queue success`
                )
            )
            .catch((err) =>
                console.error(
                    `${Date.now()} cryptohistory: sync write ${coin} queue failed ${
                        err.message
                    }`
                )
            );
    });
};

const parseTable = async (response) => {
    const $ = cheerio.load(await response.text());
    const table = $('#curr_table');
    let results = [];
    table.find('tbody > tr').each(function (i, el) {
        const tds = $(el).find('td');
        results.push({
            date: $(tds[0]).data('real-value'),
            price: parseFloat(
                $(tds[1]).attr('data-real-value').replace(/,/g, '')
            ),
            open: parseFloat(
                $(tds[2]).attr('data-real-value').replace(/,/g, '')
            ),
            high: parseFloat(
                $(tds[3]).attr('data-real-value').replace(/,/g, '')
            ),
            low: parseFloat(
                $(tds[4]).attr('data-real-value').replace(/,/g, '')
            ),
            volume: parseFloat($(tds[5]).attr('data-real-value')),
            change: parseFloat($(tds[6]).text()),
        });
    });
    return results;
};

const fetchETH = async () => {
    const end_date = encodeURIComponent(
        new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        })
    ); // e.g. 07%2F11%2F2021
    try {
        const response = await fetch(
            'https://www.investing.com/instruments/HistoricalDataAjax',
            {
                headers: {
                    accept: 'text/plain, */*; q=0.01',
                    'accept-language':
                        'en-NL,en;q=0.9,nl-NL;q=0.8,nl;q=0.7,en-US;q=0.6',
                    'cache-control': 'no-cache',
                    'content-type': 'application/x-www-form-urlencoded',
                    pragma: 'no-cache',
                    'sec-ch-ua':
                        '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'x-requested-with': 'XMLHttpRequest',
                    cookie: 'PHPSESSID=lhk782gofrg3oj5sfksjpujhpd; adBlockerNewUserDomains=1626033233; StickySession=id.55338602598.732_www.investing.com; udid=d79aed168b28e144ee4a089c263f893f; protectedMedia=2; _ga=GA1.2.1801825457.1626033234; G_ENABLED_IDPS=google; OptanonAlertBoxClosed=2021-07-11T19:53:56.485Z; usprivacy=1YNN; eupubconsent-v2=CPJMPs5PJMPs5AcABBENBiCsAP_AAH_AAChQH9tf_X__b3_j-_59f_t0eY1P9_7_v-0zjhfdt-8N2f_X_L8X42M7vF36pq4KuR4Eu3LBIQdlHOHcTUmw6okVrTPsbk2Mr7NKJ7PEmnMbO2dYGH9_n93TuZKY7__8___z__-v_v____f_r-3_3__59X---_e_V399zLv9_____9nNgfuASYal8AF2JY4Mk0aVQogQhWEh0AoAKKAYWiawgZXBTsrgI9QQMAEJqAjAiBBiCjFgEAAgEASERASAHggEQBEAgABACpAQgAI2AQWAFgYBAAKAaFiBFAEIEhBkcFRymBARItFBPZWAJRd7GmEIZRYAUCj-iowEShBAsDISFg5jgAAA.f_gAD_gAAAAA; __cflb=02DiuGRugds2TUWHMkkPGwb3ZsydSNnLS2orbJVCZxwLg; smd=d79aed168b28e144ee4a089c263f893f-1630241411; geoC=NL; logglytrackingsession=fc540ae6-4498-4e6f-a135-09330cbf1816; _gid=GA1.2.1342416145.1630241412; __cf_bm=53193391671f43af10761b4ddd1cdd04f218bff6-1630241413-1800-AZUqkhUGPDZN3WxfiXIAwHrCbMq+KbkGvEsdeSwO74ozwYiWZC18CuR8ys/cUxNOYtaDiLZYmQxMY5jKd/wZFRjfQN/5DRInDSa0um2BtJ5TCkw5KeXPbGrM9vKEhlwEvw==; OB-USER-TOKEN=b29113f4-35c9-474b-9058-95109cf63c3e; gtmFired=OK; adsFreeSalePopUp=3; _fbp=fb.1.1630241606123.1161687910; __gads=ID=f43b7f022fd1a180:T=1630241605:S=ALNI_MYVewYLGmLtRrP-Wxw4BmZd8Okd1A; r_p_s_n=1; OptanonConsent=isIABGlobal=false&datestamp=Sun+Aug+29+2021+14%3A53%3A40+GMT%2B0200+(Central+European+Summer+Time)&version=6.12.0&hosts=&consentId=d550e522-d476-4fd2-a36d-1ba2112c8955&interactionCount=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1%2CSTACK42%3A1&geolocation=NL%3BZH&AwaitingReconsent=false; nyxDorf=MzQzYGQyYTxmOjs%2BNG8yND9kMmAxPjdjYTNhaGBmYmI1Yj9obzw0ZTNuOTNha2NkPztjaT4%2BM2U1M2RsMj1nNzNlM2BkMA%3D%3D',
                },
                referrer:
                    'https://www.investing.com/crypto/ethereum/historical-data',
                referrerPolicy: 'strict-origin-when-cross-origin',
                body: `curr_id=1061972&smlID=25674078&header=null&st_date=01%2F01%2F2013&end_date=${end_date}&interval_sec=Daily&sort_col=date&sort_ord=DESC&action=historical_data`,
                method: 'POST',
                mode: 'cors',
            }
        );

        const results = parseTable(response);
        return results;
    } catch (error) {
        return console.debug(
            `${Date.now()} cryptohistory: retrieve eth cryptohistory failed ${error}`
        );
    }
};

const fetchBTC = async () => {
    const end_date = encodeURIComponent(
        new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        })
    ); // e.g. 07%2F11%2F2021

    try {
        const response = await fetch(
            'https://www.investing.com/instruments/HistoricalDataAjax',
            {
                method: 'POST',
                headers: {
                    authority: 'www.investing.com',
                    pragma: 'no-cache',
                    'cache-control': 'no-cache',
                    'sec-ch-ua':
                        '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                    accept: 'text/plain, */*; q=0.01',
                    'x-requested-with': 'XMLHttpRequest',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                    'content-type': 'application/x-www-form-urlencoded',
                    origin: 'https://www.investing.com',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer:
                        'https://www.investing.com/crypto/bitcoin/historical-data?cid=1057388',
                    'accept-language':
                        'en-NL,en;q=0.9,nl-NL;q=0.8,nl;q=0.7,en-US;q=0.6',
                },
                body: `curr_id=1057388&smlID=25609848&header=null&st_date=01%2F01%2F2013&end_date=${end_date}&interval_sec=Daily&sort_col=date&sort_ord=DESC&action=historical_data`,
            }
        );
        const results = parseTable(response);
        return results;
    } catch (error) {
        return console.debug(
            `${Date.now()} cryptohistory: retrieve btc cryptohistory failed ${error}`
        );
    }
};

const logCryptoHistory = async (influxClient) => {
    const ethHistory = await fetchETH();
    const btcHistory = await fetchBTC();
    writeInflux(influxClient, ethHistory, 'eth');
    writeInflux(influxClient, btcHistory, 'btc');
};

module.exports = logCryptoHistory;
