const axios = require('axios').default
const cheerio = require('cheerio');
const fs = require('fs')
const csv = require('csv')

let allProblemCodes = {
    A: ["A", "A1", "A2"],
    B: ["B", "B1", "B2"],
    C: ["C", "C1", "C2"],
    D: ["D", "D1", "D2"],
    E: ["E", "E1", "E2"],
    F: ["F", "F1", "F2"],
    G: ["G", "G1", "G2"],
}

let allContestPatterns = {
    div1: /Codeforces Round #... \(Div. 1\)/i,
    div2: /Codeforces Round #... \(Div. 2\)/i,
    div3: /Codeforces Round #... \(Div. 3\)/i,
}

async function main() {

    //parameters
    let pattern = allContestPatterns.div2;
    let problemCodes = allProblemCodes.D;
    const contestsToSearch = 500;
    const fileName = "div2_D_500.csv";

    //logic
    if (fs.existsSync(fileName)) {
        fs.rmSync(fileName)
    }
    const writeStream = fs.createWriteStream(fileName);
    let header = ['name', 'link', 'code', 'difficulty', 'contest name', 'contest link']
    const csvStream = csv.stringify({
        header: header
    })
    csvStream.pipe(writeStream)
    console.log('getting details of contests...')
    const contestDetails = await getLastestContestDetails(contestsToSearch)
    for (let detail of contestDetails) {
        if (pattern.test(detail.contestName)) {
            console.log(`contest found: ${detail.contestName}`)
            const problemLinks = await getProblemLinksInContest(detail)
            for (let link of problemLinks) {
                let tokens = link.split('/');
                let code = tokens[tokens.length - 1].trim();
                if (problemCodes.includes(code)) {
                    console.log(`problem found: ${link}`)
                    let problemDetail = await getDetailsFromProblemLink(link);
                    let dataUnit = {
                        problemName: problemDetail.name,
                        problemLink: problemDetail.problemLink,
                        problemCode: problemDetail.code,
                        problemDifficulty: problemDetail.difficulty,
                        contestName: detail.contestName,
                        contestLink: detail.contestLink
                    }
                    csvStream.write(dataUnit)
                }
            }
        }
    }
}

/**
 * @description returns latest n number of contest details by scanning multiple pages
 */
async function getLastestContestDetails(limit) {
    let currentContestCount = 0;
    let contestDetails = []
    let currentPage = 1;
    while (currentContestCount < limit) {
        let contestList = await getContestDetailsOnPage(currentPage);
        for (let detail of contestList) {
            if (currentContestCount < limit) {
                contestDetails.push(detail);
                currentContestCount++;
            }
        }
        currentPage++;
    }
    return contestDetails;
}

/**
 * @description returns list of details present on one page
 */
async function getContestDetailsOnPage(pageNumber) {
    let contestDetails = [];
    const resp = await axios.get(`http://codeforces.com/contests/page/${pageNumber}`);
    const html = resp.data;
    const homePageDoc = cheerio.load(html);
    // for each contest detail
    for (let el of homePageDoc('#pageContent > div.contestList > div.contests-table > div.datatable > div:nth-child(6) > table > tbody > tr > td:nth-child(1)')) {
        const contestName = el.children[0].data.trim();
        const contestLink = "http://codeforces.com" + el.children[3].attribs.href.trim();
        //create details object
        const contestDetail = {
            contestName,
            contestLink,
        }
        contestDetails.push(contestDetail)
    }
    return contestDetails;
}

async function getProblemLinksInContest(contestDetail) {
    let problemLinks = []
    const resp = await axios(`${contestDetail.contestLink}`)
    const contestPageHTML = resp.data;
    const contestPageDoc = cheerio.load(contestPageHTML);
    //for each row
    for (let el of contestPageDoc('#pageContent > div.datatable > div:nth-child(6) > table > tbody > tr > td:nth-child(1) > a:nth-child(1)')) {
        let problemLink = "http://codeforces.com" + el.attribs.href.trim();
        problemLinks.push(problemLink)
    }
    return problemLinks;
}

async function getDetailsFromProblemLink(problemLink) {
    let details = {}
    let resp = await axios.get(`${problemLink}`)
    const problemPageDoc = cheerio.load(resp.data)
    let difficulty = "NA"
    let name = ""
    let code = ""
    //difficulty selector
    for (let el of problemPageDoc('span[title="Difficulty"]')) {
        difficulty = el.children[0].data.trim().split('*')[1];
    }
    //title selector
    for (let el of problemPageDoc('#pageContent > div.problemindexholder > div.ttypography > div > div.header > div.title')) {
        name = el.children[0].data.trim().split('.')[1].trim()
        code = el.children[0].data.trim().split('.')[0].trim()
    }
    details.difficulty = difficulty;
    details.name = name;
    details.code = code;
    details.problemLink = problemLink;
    return details;
}

main().catch(err => {
    console.log(err)
    process.exit(-1)
})
