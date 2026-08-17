export interface CurrencyInfo {
  code: string;
  name: string;
  territory: string;
}

const ROWS = `
AED|UAE Dirham|United Arab Emirates
AFN|Afghani|Afghanistan
ALL|Lek|Albania
AMD|Armenian Dram|Armenia
ANG|Caribbean Guilder|Curaçao and Sint Maarten
AOA|Kwanza|Angola
ARS|Argentine Peso|Argentina
AUD|Australian Dollar|Australia
AWG|Aruban Florin|Aruba
AZN|Azerbaijan Manat|Azerbaijan
BAM|Convertible Mark|Bosnia and Herzegovina
BBD|Barbados Dollar|Barbados
BDT|Taka|Bangladesh
BGN|Bulgarian Lev|Bulgaria
BHD|Bahraini Dinar|Bahrain
BIF|Burundi Franc|Burundi
BMD|Bermudian Dollar|Bermuda
BND|Brunei Dollar|Brunei
BOB|Boliviano|Bolivia
BOV|Mvdol|Bolivia
BRL|Brazilian Real|Brazil
BSD|Bahamian Dollar|Bahamas
BTN|Ngultrum|Bhutan
BWP|Pula|Botswana
BYN|Belarusian Ruble|Belarus
BZD|Belize Dollar|Belize
CAD|Canadian Dollar|Canada
CDF|Congolese Franc|DR Congo
CHE|WIR Euro|Switzerland
CHF|Swiss Franc|Switzerland and Liechtenstein
CHW|WIR Franc|Switzerland
CLF|Unidad de Fomento|Chile
CLP|Chilean Peso|Chile
CNY|Yuan Renminbi|China
COP|Colombian Peso|Colombia
COU|Unidad de Valor Real|Colombia
CRC|Costa Rican Colón|Costa Rica
CUP|Cuban Peso|Cuba
CVE|Cabo Verde Escudo|Cabo Verde
CZK|Czech Koruna|Czechia
DJF|Djibouti Franc|Djibouti
DKK|Danish Krone|Denmark
DOP|Dominican Peso|Dominican Republic
DZD|Algerian Dinar|Algeria
EGP|Egyptian Pound|Egypt
ERN|Nakfa|Eritrea
ETB|Ethiopian Birr|Ethiopia
EUR|Euro|Eurozone
FJD|Fiji Dollar|Fiji
FKP|Falkland Islands Pound|Falkland Islands
GBP|Pound Sterling|United Kingdom
GEL|Lari|Georgia
GHS|Ghana Cedi|Ghana
GIP|Gibraltar Pound|Gibraltar
GMD|Dalasi|Gambia
GNF|Guinean Franc|Guinea
GTQ|Quetzal|Guatemala
GYD|Guyana Dollar|Guyana
HKD|Hong Kong Dollar|Hong Kong
HNL|Lempira|Honduras
HTG|Gourde|Haiti
HUF|Forint|Hungary
IDR|Rupiah|Indonesia
ILS|New Israeli Shekel|Israel
INR|Indian Rupee|India
IQD|Iraqi Dinar|Iraq
IRR|Iranian Rial|Iran
ISK|Iceland Krona|Iceland
JMD|Jamaican Dollar|Jamaica
JOD|Jordanian Dinar|Jordan
JPY|Yen|Japan
KES|Kenyan Shilling|Kenya
KGS|Som|Kyrgyzstan
KHR|Riel|Cambodia
KMF|Comorian Franc|Comoros
KPW|North Korean Won|North Korea
KRW|South Korean Won|South Korea
KWD|Kuwaiti Dinar|Kuwait
KYD|Cayman Islands Dollar|Cayman Islands
KZT|Tenge|Kazakhstan
LAK|Lao Kip|Laos
LBP|Lebanese Pound|Lebanon
LKR|Sri Lanka Rupee|Sri Lanka
LRD|Liberian Dollar|Liberia
LSL|Loti|Lesotho
LYD|Libyan Dinar|Libya
MAD|Moroccan Dirham|Morocco
MDL|Moldovan Leu|Moldova
MGA|Malagasy Ariary|Madagascar
MKD|Denar|North Macedonia
MMK|Kyat|Myanmar
MNT|Tugrik|Mongolia
MOP|Pataca|Macao
MRU|Ouguiya|Mauritania
MUR|Mauritius Rupee|Mauritius
MVR|Rufiyaa|Maldives
MWK|Malawi Kwacha|Malawi
MXN|Mexican Peso|Mexico
MXV|Mexican Investment Unit|Mexico
MYR|Malaysian Ringgit|Malaysia
MZN|Mozambique Metical|Mozambique
NAD|Namibia Dollar|Namibia
NGN|Naira|Nigeria
NIO|Córdoba Oro|Nicaragua
NOK|Norwegian Krone|Norway
NPR|Nepalese Rupee|Nepal
NZD|New Zealand Dollar|New Zealand
OMR|Rial Omani|Oman
PAB|Balboa|Panama
PEN|Sol|Peru
PGK|Kina|Papua New Guinea
PHP|Philippine Peso|Philippines
PKR|Pakistan Rupee|Pakistan
PLN|Zloty|Poland
PYG|Guarani|Paraguay
QAR|Qatari Rial|Qatar
RON|Romanian Leu|Romania
RSD|Serbian Dinar|Serbia
RUB|Russian Ruble|Russia
RWF|Rwanda Franc|Rwanda
SAR|Saudi Riyal|Saudi Arabia
SBD|Solomon Islands Dollar|Solomon Islands
SCR|Seychelles Rupee|Seychelles
SDG|Sudanese Pound|Sudan
SEK|Swedish Krona|Sweden
SGD|Singapore Dollar|Singapore
SHP|Saint Helena Pound|Saint Helena
SLE|Leone|Sierra Leone
SOS|Somali Shilling|Somalia
SRD|Surinam Dollar|Suriname
SSP|South Sudanese Pound|South Sudan
STN|Dobra|São Tomé and Príncipe
SVC|El Salvador Colón|El Salvador
SYP|Syrian Pound|Syria
SZL|Lilangeni|Eswatini
THB|Baht|Thailand
TJS|Somoni|Tajikistan
TMT|Turkmenistan Manat|Turkmenistan
TND|Tunisian Dinar|Tunisia
TOP|Paʻanga|Tonga
TRY|Turkish Lira|Türkiye
TTD|Trinidad and Tobago Dollar|Trinidad and Tobago
TWD|New Taiwan Dollar|Taiwan
TZS|Tanzanian Shilling|Tanzania
UAH|Hryvnia|Ukraine
UGX|Uganda Shilling|Uganda
USD|US Dollar|United States
USN|US Dollar (Next Day)|United States
UYI|Uruguay Peso Indexed Unit|Uruguay
UYU|Peso Uruguayo|Uruguay
UYW|Unidad Previsional|Uruguay
UZS|Uzbekistan Sum|Uzbekistan
VED|Digital Bolívar|Venezuela
VES|Bolívar Soberano|Venezuela
VND|Dong|Vietnam
VUV|Vatu|Vanuatu
WST|Tala|Samoa
XAF|CFA Franc BEAC|Central Africa
XAG|Silver|International precious metal
XAU|Gold|International precious metal
XBA|European Composite Unit|International bond market
XBB|European Monetary Unit|International bond market
XBC|European Unit of Account 9|International bond market
XBD|European Unit of Account 17|International bond market
XCD|East Caribbean Dollar|Eastern Caribbean
XCG|Caribbean Guilder|Curaçao and Sint Maarten
XDR|Special Drawing Right|International Monetary Fund
XOF|CFA Franc BCEAO|West Africa
XPD|Palladium|International precious metal
XPF|CFP Franc|French Pacific territories
XPT|Platinum|International precious metal
XSU|SUCRE|ALBA member states
XTS|Testing Code|International testing
XUA|ADB Unit of Account|African Development Bank
XXX|No Currency|International
YER|Yemeni Rial|Yemen
ZAR|Rand|South Africa
ZMW|Zambian Kwacha|Zambia
ZWG|Zimbabwe Gold|Zimbabwe
`;

export const CURRENCIES: CurrencyInfo[] = ROWS.trim()
  .split("\n")
  .map((row) => {
    const [code, name, territory] = row.split("|");
    return { code, name, territory };
  });

export const CURRENCY_CODES = new Set(CURRENCIES.map(({ code }) => code));

export function currencyInfo(code: string): CurrencyInfo {
  return (
    CURRENCIES.find((currency) => currency.code === code) ?? {
      code,
      name: code,
      territory: "International or special unit",
    }
  );
}
