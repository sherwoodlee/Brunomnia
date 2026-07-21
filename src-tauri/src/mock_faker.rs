use chrono::{Duration, SecondsFormat, Utc};
use uuid::Uuid;

#[cfg(test)]
const SUPPORTED_VARIABLES: &[&str] = &[
    "guid",
    "randomUUID",
    "randomAlphaNumeric",
    "randomBoolean",
    "randomInt",
    "timestamp",
    "isoTimestamp",
    "randomColor",
    "randomHexColor",
    "randomAbbreviation",
    "randomSemver",
    "randomDateFuture",
    "randomDatePast",
    "randomDateRecent",
    "randomWeekday",
    "randomMonth",
    "randomNoun",
    "randomVerb",
    "randomIngverb",
    "randomAdjective",
    "randomWord",
    "randomWords",
    "randomPhrase",
    "randomLoremWord",
    "randomLoremWords",
    "randomLoremSentence",
    "randomLoremSentences",
    "randomLoremParagraph",
    "randomLoremParagraphs",
    "randomLoremText",
    "randomLoremSlug",
    "randomLoremLines",
    "randomPhoneNumber",
    "randomPhoneNumberExt",
    "randomIP",
    "randomIPV6",
    "randomMACAddress",
    "randomPassword",
    "randomLocale",
    "randomUserAgent",
    "randomProtocol",
    "randomDomainName",
    "randomDomainSuffix",
    "randomDomainWord",
    "randomEmail",
    "randomExampleEmail",
    "randomUserName",
    "randomUrl",
    "randomFirstName",
    "randomLastName",
    "randomFullName",
    "randomNamePrefix",
    "randomNameSuffix",
    "randomCity",
    "randomStreetName",
    "randomStreetAddress",
    "randomCountry",
    "randomCountryCode",
    "randomLatitude",
    "randomLongitude",
    "randomJobArea",
    "randomJobDescriptor",
    "randomJobTitle",
    "randomJobType",
    "randomAvatarImage",
    "randomImageUrl",
    "randomImageDataUri",
    "randomAbstractImage",
    "randomAnimalsImage",
    "randomBusinessImage",
    "randomCatsImage",
    "randomCityImage",
    "randomFoodImage",
    "randomNightlifeImage",
    "randomFashionImage",
    "randomPeopleImage",
    "randomNatureImage",
    "randomSportsImage",
    "randomTransportImage",
    "randomBankAccount",
    "randomBankAccountName",
    "randomCreditCardMask",
    "randomBankAccountBic",
    "randomBankAccountIban",
    "randomTransactionType",
    "randomCurrencyCode",
    "randomCurrencyName",
    "randomCurrencySymbol",
    "randomBitcoin",
    "randomCompanyName",
    "randomCompanySuffix",
    "randomBs",
    "randomBsAdjective",
    "randomBsBuzz",
    "randomBsNoun",
    "randomCatchPhrase",
    "randomCatchPhraseAdjective",
    "randomCatchPhraseDescriptor",
    "randomCatchPhraseNoun",
    "randomDatabaseColumn",
    "randomDatabaseType",
    "randomDatabaseCollation",
    "randomDatabaseEngine",
    "randomFileName",
    "randomFileType",
    "randomFileExt",
    "randomCommonFileName",
    "randomCommonFileType",
    "randomCommonFileExt",
    "randomFilePath",
    "randomDirectoryPath",
    "randomMimeType",
    "randomPrice",
    "randomProduct",
    "randomProductAdjective",
    "randomProductMaterial",
    "randomProductName",
    "randomDepartment",
];

const FIRST_NAMES: &[&str] = &[
    "Avery", "Jordan", "Morgan", "Riley", "Taylor", "Ethan", "Olga", "Priya",
];
const LAST_NAMES: &[&str] = &[
    "Chen", "Garcia", "Johnson", "Patel", "Williams", "Olson", "Stehr", "Okafor",
];
const COLORS: &[&str] = &["turquoise", "indigo", "coral", "emerald", "violet", "amber"];
const COUNTRIES: &[(&str, &str)] = &[
    ("Canada", "CA"),
    ("France", "FR"),
    ("Germany", "DE"),
    ("India", "IN"),
    ("Japan", "JP"),
    ("New Zealand", "NZ"),
    ("United Kingdom", "GB"),
    ("United States", "US"),
];
const LOREM: &[&str] = &[
    "adipisci",
    "aliquam",
    "amet",
    "consectetur",
    "dolorem",
    "fugiat",
    "ipsum",
    "magnam",
    "numquam",
    "porro",
    "quaerat",
    "repudiandae",
    "tempora",
    "voluptas",
];
const HACKER_NOUNS: &[&str] = &[
    "bandwidth",
    "firewall",
    "interface",
    "pixel",
    "port",
    "protocol",
    "sensor",
    "system",
];
const HACKER_VERBS: &[&str] = &[
    "calculate",
    "compress",
    "index",
    "navigate",
    "override",
    "parse",
    "program",
    "transmit",
];
const HACKER_ADJECTIVES: &[&str] = &[
    "auxiliary",
    "cross-platform",
    "digital",
    "mobile",
    "neural",
    "virtual",
    "wireless",
];
const COMPANY_ADJECTIVES: &[&str] = &[
    "Adaptive",
    "Global",
    "Integrated",
    "Progressive",
    "Synchronised",
    "Visionary",
];
const COMPANY_DESCRIPTORS: &[&str] = &[
    "Data",
    "Logistics",
    "Security",
    "Solutions",
    "Systems",
    "Technology",
];
const COMPANY_NOUNS: &[&str] = &[
    "Alliance",
    "Collective",
    "Group",
    "Labs",
    "Network",
    "Partners",
];
const CURRENCIES: &[(&str, &str, &str)] = &[
    ("USD", "US Dollar", "$"),
    ("EUR", "Euro", "€"),
    ("GBP", "Pound Sterling", "£"),
    ("JPY", "Japanese Yen", "¥"),
    ("CAD", "Canadian Dollar", "C$"),
];
const DIRECTORIES: &[&str] = &[
    "/etc",
    "/opt/app",
    "/tmp",
    "/usr/local/share",
    "/var/lib/app",
];
const FILE_EXTENSIONS: &[(&str, &str)] = &[
    ("json", "application/json"),
    ("png", "image/png"),
    ("pdf", "application/pdf"),
    ("mp3", "audio/mpeg"),
    ("txt", "text/plain"),
    ("csv", "text/csv"),
];

struct LocalRandom(u64);

impl LocalRandom {
    fn new() -> Self {
        let bytes = Uuid::new_v4().into_bytes();
        let mut seed = [0_u8; 8];
        seed.copy_from_slice(&bytes[..8]);
        let value = u64::from_le_bytes(seed);
        Self(if value == 0 {
            0x9e37_79b9_7f4a_7c15
        } else {
            value
        })
    }

    fn next(&mut self) -> u64 {
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        self.0 = self.0.wrapping_mul(0x2545_f491_4f6c_dd1d);
        self.0
    }

    fn index(&mut self, length: usize) -> usize {
        (self.next() as usize) % length
    }

    fn range(&mut self, minimum: u64, maximum: u64) -> u64 {
        minimum + self.next() % (maximum - minimum + 1)
    }
}

fn pick<'a, T>(random: &mut LocalRandom, values: &'a [T]) -> &'a T {
    &values[random.index(values.len())]
}

fn random_chars(random: &mut LocalRandom, alphabet: &[u8], length: usize) -> String {
    (0..length)
        .map(|_| alphabet[random.index(alphabet.len())] as char)
        .collect()
}

fn digits(random: &mut LocalRandom, length: usize) -> String {
    random_chars(random, b"0123456789", length)
}

fn first_name(random: &mut LocalRandom) -> &'static str {
    FIRST_NAMES[random.index(FIRST_NAMES.len())]
}

fn last_name(random: &mut LocalRandom) -> &'static str {
    LAST_NAMES[random.index(LAST_NAMES.len())]
}

fn domain_word(random: &mut LocalRandom) -> String {
    format!(
        "{}-{}",
        pick(random, HACKER_ADJECTIVES).replace(' ', "-"),
        pick(random, HACKER_NOUNS)
    )
    .to_ascii_lowercase()
}

fn lorem_words(random: &mut LocalRandom, count: usize) -> String {
    (0..count)
        .map(|_| *pick(random, LOREM))
        .collect::<Vec<_>>()
        .join(" ")
}

fn sentence(random: &mut LocalRandom) -> String {
    let mut value = lorem_words(random, 5);
    if let Some(first) = value.get_mut(0..1) {
        first.make_ascii_uppercase();
    }
    value.push('.');
    value
}

fn company_name(random: &mut LocalRandom) -> String {
    format!(
        "{} {} {}",
        pick(random, COMPANY_ADJECTIVES),
        pick(random, COMPANY_DESCRIPTORS),
        pick(random, COMPANY_NOUNS)
    )
}

fn file_parts(random: &mut LocalRandom) -> (String, &'static str, &'static str) {
    let (extension, mime) = *pick(random, FILE_EXTENSIONS);
    let name = format!(
        "{}_{}.{}",
        pick(random, HACKER_ADJECTIVES),
        pick(random, HACKER_NOUNS),
        extension
    )
    .replace('-', "_");
    (name, extension, mime)
}

fn image_url(category: Option<&str>) -> String {
    category
        .map(|category| format!("https://loremflickr.com/640/480/{category}"))
        .unwrap_or_else(|| "https://loremflickr.com/640/480".into())
}

fn date_with_day_offset(random: &mut LocalRandom, minimum: i64, maximum: i64) -> String {
    let offset = minimum + random.range(0, (maximum - minimum) as u64) as i64;
    (Utc::now() + Duration::days(offset)).to_rfc3339_opts(SecondsFormat::Millis, true)
}

pub fn value(name: &str) -> Option<String> {
    let mut random = LocalRandom::new();
    let value = match name {
        "guid" | "randomUUID" => Uuid::new_v4().to_string(),
        "randomAlphaNumeric" => random_chars(&mut random, b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 1),
        "randomBoolean" => (random.next() & 1 == 1).to_string(),
        "randomInt" => random.range(0, 10_000).to_string(),
        "timestamp" => Utc::now().timestamp_millis().to_string(),
        "isoTimestamp" => Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        "randomColor" => pick(&mut random, COLORS).to_string(),
        "randomHexColor" => format!("#{}", random_chars(&mut random, b"0123456789abcdef", 6)),
        "randomAbbreviation" => pick(&mut random, &["CSS", "FTP", "HTTP", "JSON", "SSL", "TCP"]).to_string(),
        "randomSemver" => format!("{}.{}.{}", random.range(0, 12), random.range(0, 20), random.range(0, 30)),
        "randomDateFuture" => date_with_day_offset(&mut random, 1, 365),
        "randomDatePast" => date_with_day_offset(&mut random, -365, -1),
        "randomDateRecent" => date_with_day_offset(&mut random, -3, -1),
        "randomWeekday" => pick(&mut random, &["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]).to_string(),
        "randomMonth" => pick(&mut random, &["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]).to_string(),
        "randomNoun" | "randomWord" => pick(&mut random, HACKER_NOUNS).to_string(),
        "randomVerb" => pick(&mut random, HACKER_VERBS).to_string(),
        "randomIngverb" => format!("{}ing", pick(&mut random, HACKER_VERBS).trim_end_matches('e')),
        "randomAdjective" => pick(&mut random, HACKER_ADJECTIVES).to_string(),
        "randomWords" | "randomLoremWords" => lorem_words(&mut random, 3),
        "randomPhrase" => format!("Try to {} the {} {}, maybe it will {} the {} {}!", pick(&mut random, HACKER_VERBS), pick(&mut random, HACKER_ADJECTIVES), pick(&mut random, HACKER_NOUNS), pick(&mut random, HACKER_VERBS), pick(&mut random, HACKER_ADJECTIVES), pick(&mut random, HACKER_NOUNS)),
        "randomLoremWord" => pick(&mut random, LOREM).to_string(),
        "randomLoremSentence" => sentence(&mut random),
        "randomLoremSentences" => format!("{} {}", sentence(&mut random), sentence(&mut random)),
        "randomLoremParagraph" | "randomLoremText" => format!("{} {} {}", sentence(&mut random), sentence(&mut random), sentence(&mut random)),
        "randomLoremParagraphs" => format!("{} {}\n{} {}", sentence(&mut random), sentence(&mut random), sentence(&mut random), sentence(&mut random)),
        "randomLoremSlug" => lorem_words(&mut random, 3).replace(' ', "-"),
        "randomLoremLines" => format!("{}\n{}", sentence(&mut random), sentence(&mut random)),
        "randomPhoneNumber" | "randomPhoneNumberExt" => format!("{}-{}-{}", digits(&mut random, 3), digits(&mut random, 3), digits(&mut random, 4)),
        "randomIP" => format!("203.0.113.{}", random.range(1, 254)),
        "randomIPV6" => format!("2001:0db8:{:04x}:{:04x}:{:04x}:{:04x}:{:04x}:{:04x}", random.range(0, 65_535), random.range(0, 65_535), random.range(0, 65_535), random.range(0, 65_535), random.range(0, 65_535), random.range(0, 65_535)),
        "randomMACAddress" => (0..6).map(|_| format!("{:02x}", random.range(0, 255))).collect::<Vec<_>>().join(":"),
        "randomPassword" => random_chars(&mut random, b"23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", 16),
        "randomLocale" | "randomCountryCode" => pick(&mut random, COUNTRIES).1.to_string(),
        "randomUserAgent" => pick(&mut random, &["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0 Safari/537.36", "Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/137.0"]).to_string(),
        "randomProtocol" => pick(&mut random, &["http", "https"]).to_string(),
        "randomDomainSuffix" => pick(&mut random, &["biz", "com", "dev", "io", "net", "org"]).to_string(),
        "randomDomainWord" => domain_word(&mut random),
        "randomDomainName" => format!("{}.{}", domain_word(&mut random), pick(&mut random, &["biz", "com", "dev", "io", "net", "org"])),
        "randomEmail" => format!("{}.{}{}@{}.com", first_name(&mut random).to_ascii_lowercase(), last_name(&mut random).to_ascii_lowercase(), random.range(1, 99), domain_word(&mut random)),
        "randomExampleEmail" => format!("{}.{}@example.{}", first_name(&mut random).to_ascii_lowercase(), last_name(&mut random).to_ascii_lowercase(), pick(&mut random, &["com", "org", "net"])),
        "randomUserName" => format!("{}.{}{}", first_name(&mut random), last_name(&mut random), random.range(1, 99)),
        "randomUrl" => format!("https://{}.{}", domain_word(&mut random), pick(&mut random, &["com", "dev", "io", "org"])),
        "randomFirstName" => first_name(&mut random).to_string(),
        "randomLastName" => last_name(&mut random).to_string(),
        "randomFullName" => format!("{} {}", first_name(&mut random), last_name(&mut random)),
        "randomNamePrefix" => pick(&mut random, &["Dr.", "Miss", "Mr.", "Mrs.", "Mx.", "Prof."]).to_string(),
        "randomNameSuffix" => pick(&mut random, &["II", "III", "Jr.", "PhD", "Sr."]).to_string(),
        "randomCity" => pick(&mut random, &["Austin", "Berlin", "Kyoto", "Lagos", "Montreal", "Wellington"]).to_string(),
        "randomStreetName" => format!("{} {}", pick(&mut random, LAST_NAMES), pick(&mut random, &["Avenue", "Boulevard", "Island", "Lane", "Street", "Way"])),
        "randomStreetAddress" => format!("{} {} {}", random.range(1, 9999), pick(&mut random, LAST_NAMES), pick(&mut random, &["Avenue", "Boulevard", "Lane", "Street", "Way"])),
        "randomCountry" => pick(&mut random, COUNTRIES).0.to_string(),
        "randomLatitude" => format!("{:.4}", random.range(0, 1_800_000) as f64 / 10_000.0 - 90.0),
        "randomLongitude" => format!("{:.4}", random.range(0, 3_600_000) as f64 / 10_000.0 - 180.0),
        "randomJobArea" => pick(&mut random, &["Engineering", "Infrastructure", "Operations", "Security", "Tactics"]).to_string(),
        "randomJobDescriptor" => pick(&mut random, &["Dynamic", "Forward", "Lead", "Principal", "Regional"]).to_string(),
        "randomJobTitle" => format!("{} {} {}", pick(&mut random, &["Forward", "Lead", "Principal", "Regional"]), pick(&mut random, &["Data", "Security", "Systems", "Tactics"]), pick(&mut random, &["Architect", "Coordinator", "Engineer", "Liaison"])),
        "randomJobType" => pick(&mut random, &["Architect", "Coordinator", "Engineer", "Liaison", "Specialist"]).to_string(),
        "randomAvatarImage" => format!("https://avatars.githubusercontent.com/u/{}", random.range(1, 99_999_999)),
        "randomImageUrl" => image_url(None),
        "randomImageDataUri" => format!("data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22640%22%20height%3D%22480%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23{}%22%2F%3E%3C%2Fsvg%3E", random_chars(&mut random, b"0123456789abcdef", 6)),
        "randomAbstractImage" => image_url(Some("abstract")),
        "randomAnimalsImage" => image_url(Some("animals")),
        "randomBusinessImage" => image_url(Some("business")),
        "randomCatsImage" => image_url(Some("cats")),
        "randomCityImage" => image_url(Some("city")),
        "randomFoodImage" => image_url(Some("food")),
        "randomNightlifeImage" => image_url(Some("nightlife")),
        "randomFashionImage" => image_url(Some("fashion")),
        "randomPeopleImage" => image_url(Some("people")),
        "randomNatureImage" => image_url(Some("nature")),
        "randomSportsImage" => image_url(Some("sports")),
        "randomTransportImage" => image_url(Some("transport")),
        "randomBankAccount" => digits(&mut random, 10),
        "randomBankAccountName" => pick(&mut random, &["Checking Account", "Investment Account", "Money Market Account", "Savings Account"]).to_string(),
        "randomCreditCardMask" => format!("**** **** **** {}", digits(&mut random, 4)),
        "randomBankAccountBic" => pick(&mut random, &["BOFAUS3N", "DEUTDEFF", "NWBKGB2L", "ROYCCAT2"]).to_string(),
        "randomBankAccountIban" => pick(&mut random, &["DE89370400440532013000", "GB82WEST12345698765432", "FR1420041010050500013M02606"]).to_string(),
        "randomTransactionType" => pick(&mut random, &["deposit", "invoice", "payment", "transfer", "withdrawal"]).to_string(),
        "randomCurrencyCode" => pick(&mut random, CURRENCIES).0.to_string(),
        "randomCurrencyName" => pick(&mut random, CURRENCIES).1.to_string(),
        "randomCurrencySymbol" => pick(&mut random, CURRENCIES).2.to_string(),
        "randomBitcoin" => pick(&mut random, &["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", "1BoatSLRHtKNngkdXEeobR76b53LETtpyT", "1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp"]).to_string(),
        "randomCompanyName" | "randomCompanySuffix" => company_name(&mut random),
        "randomBsAdjective" => pick(&mut random, &["bleeding-edge", "bricks-and-clicks", "cross-media", "distributed", "frictionless"]).to_string(),
        "randomBsBuzz" => pick(&mut random, &["aggregate", "deliver", "enable", "scale", "unleash"]).to_string(),
        "randomBsNoun" => pick(&mut random, &["architectures", "communities", "markets", "platforms", "portals"]).to_string(),
        "randomBs" => format!("{} {} {}", pick(&mut random, &["aggregate", "deliver", "enable", "scale", "unleash"]), pick(&mut random, &["bleeding-edge", "bricks-and-clicks", "cross-media", "distributed", "frictionless"]), pick(&mut random, &["architectures", "communities", "markets", "platforms", "portals"])),
        "randomCatchPhraseAdjective" => pick(&mut random, COMPANY_ADJECTIVES).to_string(),
        "randomCatchPhraseDescriptor" => pick(&mut random, COMPANY_DESCRIPTORS).to_ascii_lowercase(),
        "randomCatchPhraseNoun" => pick(&mut random, COMPANY_NOUNS).to_ascii_lowercase(),
        "randomCatchPhrase" => format!("{} {} {}", pick(&mut random, COMPANY_ADJECTIVES), pick(&mut random, COMPANY_DESCRIPTORS).to_ascii_lowercase(), pick(&mut random, COMPANY_NOUNS).to_ascii_lowercase()),
        "randomDatabaseColumn" => pick(&mut random, &["created_at", "email", "id", "status", "updated_at"]).to_string(),
        "randomDatabaseType" => pick(&mut random, &["bigint", "boolean", "jsonb", "text", "timestamp", "varchar"]).to_string(),
        "randomDatabaseCollation" => pick(&mut random, &["C", "en_US.utf8", "utf8_general_ci", "utf8mb4_unicode_ci"]).to_string(),
        "randomDatabaseEngine" => pick(&mut random, &["InnoDB", "MyISAM", "PostgreSQL", "SQLite"]).to_string(),
        "randomFileName" => file_parts(&mut random).0,
        "randomFileType" => file_parts(&mut random).2.split('/').next().unwrap_or("application").to_string(),
        "randomFileExt" => file_parts(&mut random).1.to_string(),
        "randomCommonFileName" => pick(&mut random, &["archive.zip", "avatar.png", "document.pdf", "report.csv", "settings.json"]).to_string(),
        "randomCommonFileType" => pick(&mut random, &["application", "audio", "image", "text", "video"]).to_string(),
        "randomCommonFileExt" => pick(&mut random, &["csv", "json", "pdf", "png", "txt", "zip"]).to_string(),
        "randomFilePath" => format!("{}/{}", pick(&mut random, DIRECTORIES), file_parts(&mut random).0),
        "randomDirectoryPath" => pick(&mut random, DIRECTORIES).to_string(),
        "randomMimeType" => file_parts(&mut random).2.to_string(),
        "randomPrice" => format!("{}.{:02}", random.range(1, 999), random.range(0, 99)),
        "randomProduct" => pick(&mut random, &["Chair", "Gloves", "Keyboard", "Pants", "Shoes", "Table"]).to_string(),
        "randomProductAdjective" => pick(&mut random, &["Ergonomic", "Handcrafted", "Practical", "Refined", "Sleek"]).to_string(),
        "randomProductMaterial" => pick(&mut random, &["Concrete", "Cotton", "Granite", "Metal", "Rubber", "Wooden"]).to_string(),
        "randomProductName" => format!("{} {} {}", pick(&mut random, &["Ergonomic", "Handcrafted", "Practical", "Refined", "Sleek"]), pick(&mut random, &["Concrete", "Cotton", "Granite", "Metal", "Rubber", "Wooden"]), pick(&mut random, &["Chair", "Gloves", "Keyboard", "Pants", "Shoes", "Table"])),
        "randomDepartment" => pick(&mut random, &["Books", "Computers", "Garden", "Home", "Outdoors", "Sports"]).to_string(),
        _ => return None,
    };
    Some(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_every_documented_faker_variable() {
        assert_eq!(SUPPORTED_VARIABLES.len(), 118);
        for name in SUPPORTED_VARIABLES {
            let rendered = value(name).unwrap_or_else(|| panic!("missing faker variable: {name}"));
            assert!(!rendered.is_empty(), "empty faker variable: {name}");
            assert!(rendered.len() <= 1_000, "oversized faker variable: {name}");
        }
    }

    #[test]
    fn preserves_expected_faker_shapes_and_rejects_unknown_names() {
        assert!(Uuid::parse_str(&value("guid").unwrap()).is_ok());
        assert!(matches!(
            value("randomBoolean").as_deref(),
            Some("true" | "false")
        ));
        assert_eq!(value("randomAlphaNumeric").unwrap().len(), 1);
        assert_eq!(value("randomHexColor").unwrap().len(), 7);
        assert!(value("timestamp").unwrap().parse::<i64>().is_ok());
        assert!(chrono::DateTime::parse_from_rfc3339(&value("isoTimestamp").unwrap()).is_ok());
        assert!(value("randomImageDataUri")
            .unwrap()
            .starts_with("data:image/svg+xml"));
        assert_eq!(value("notDocumented"), None);
    }
}
