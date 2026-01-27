async function fetchCompanyInfo(symbol) {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}.T?modules=assetProfile,summaryDetail,defaultKeyStatistics`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      }
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      console.log('Response not OK');
      return {};
    }
    
    const data = await response.json();
    const result = data?.quoteSummary?.result?.[0];
    
    if (!result) {
      console.log('No result in response');
      return {};
    }
    
    const profile = result.assetProfile || {};
    const summaryDetail = result.summaryDetail || {};
    
    return {
      description: profile.longBusinessSummary,
      industry: profile.industry,
      employees: profile.fullTimeEmployees,
      website: profile.website,
      marketCap: summaryDetail.marketCap?.raw,
    };
  } catch (error) {
    console.error(`エラー:`, error.message);
    return {};
  }
}

fetchCompanyInfo('4901').then(info => {
  console.log('企業情報:', JSON.stringify(info, null, 2));
  console.log('Has data:', Object.keys(info).length > 0);
});
