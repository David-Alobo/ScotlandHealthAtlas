# Data audit: the competition package

## ae_activity: `data/raw/data-viz-2026/data/A&E/Level_1_Activity.csv`

39,744 rows

| Column | Type | Distinct | Missing | Min | Max |
|---|---|---|---|---|---|
| Month | BIGINT | 228 | 0 | 200707 | 202606 |
| HBName | VARCHAR | 14 | 0 | NHS Ayrshire and Arran | NHS Western Isles |
| DepartmentType | VARCHAR | 2 | 0 | Type 1 | Type 3 |
| HospitalName | VARCHAR | 87 | 2,946 | Aberdeen Royal Infirmary | Whitehills Health and Community Care Cen |
| AddressLine1 | VARCHAR | 85 | 2,946 | 1053 Great Western Road | Whitefield Road |
| AddressLine2 | VARCHAR | 74 | 6,118 | Aberdeen | Wishaw |
| Postcode | VARCHAR | 87 | 2,946 | AB252ZG | ZE1 0TB |
| AttendanceCategory | VARCHAR | 3 | 0 | All | Unplanned |
| NumberOfAttendancesAll | BIGINT | 5,642 | 0 | 1 | 11920 |
| NumberWithin4HoursAll | BIGINT | 5,228 | 0 | 0 | 10130 |
| NumberOver4HoursAll | BIGINT | 2,128 | 0 | -27 | 5963 |
| PercentageWithin4HoursAll | DOUBLE | 614 | 0 | 0.0 | 139.1 |
| NumberOfAttendancesEpisode | DOUBLE | 5,613 | 16,926 | 1.0 | 11920.0 |
| NumberWithin4HoursEpisode | DOUBLE | 5,189 | 16,926 | 0.0 | 10130.0 |
| NumberOver4HoursEpisode | DOUBLE | 2,127 | 16,926 | 0.0 | 5963.0 |
| PercentageWithin4HoursEpisode | DOUBLE | 613 | 16,926 | 0.0 | 100.0 |
| NumberOver8HoursEpisode | DOUBLE | 1,121 | 16,926 | 0.0 | 2893.0 |
| PercentageOver8HoursEpisode | DOUBLE | 321 | 16,926 | 0.0 | 100.0 |
| NumberOver12HoursEpisode | DOUBLE | 639 | 16,926 | 0.0 | 1709.0 |
| PercentageOver12HoursEpisode | DOUBLE | 189 | 16,926 | 0.0 | 33.3 |

- **HBName**: NHS Ayrshire and Arran (2,410), NHS Borders (1,781), NHS Dumfries and Galloway (2,254), NHS Fife (2,059), NHS Forth Valley (988), NHS Grampian (6,453), NHS Greater Glasgow and Clyde (4,293), NHS Highland (8,611), NHS Lanarkshire (2,124), NHS Lothian (2,370), NHS Orkney (523), NHS Shetland (523), NHS Tayside (3,853), NHS Western Isles (1,502)

- **DepartmentType**: Type 1 (15,699), Type 3 (24,045)

- **AttendanceCategory**: All (18,839), New planned (2,066), Unplanned (18,839)


## ae_demographics: `data/raw/data-viz-2026/data/A&E/Level_2_Demographics.csv`

139,269 rows

| Column | Type | Distinct | Missing | Min | Max |
|---|---|---|---|---|---|
| Month | BIGINT | 102 | 0 | 201801 | 202606 |
| HBName | VARCHAR | 14 | 0 | NHS Ayrshire and Arran | NHS Western Isles |
| DepartmentType | VARCHAR | 2 | 0 | Type 1 | Type 3 |
| Age | VARCHAR | 6 | 2,188 | 18-24 | Under 18 |
| Sex | VARCHAR | 2 | 2,188 | Female | Male |
| Deprivation | DOUBLE | 5 | 19,096 | 1.0 | 5.0 |
| NumberOfAttendances | BIGINT | 1,397 | 0 | 1 | 2412 |

- **HBName**: NHS Ayrshire and Arran (7,306), NHS Borders (7,382), NHS Dumfries and Galloway (7,572), NHS Fife (14,118), NHS Forth Valley (14,310), NHS Grampian (9,724), NHS Greater Glasgow and Clyde (14,730), NHS Highland (10,233), NHS Lanarkshire (7,853), NHS Lothian (14,379), NHS Orkney (5,269), NHS Shetland (4,432), NHS Tayside (14,106), NHS Western Isles (7,855)

- **DepartmentType**: Type 1 (94,978), Type 3 (44,291)

- **Age**: 18-24 (22,325), 25-39 (23,358), 40-64 (23,829), 65-74 (22,384), 75 plus (22,213), Under 18 (22,972), None (2,188)

- **Sex**: Female (68,313), Male (68,768), None (2,188)

- **Deprivation**: 1.0 (21,728), 2.0 (25,459), 3.0 (25,799), 4.0 (24,615), 5.0 (22,572), None (19,096)


## injury_admissions: `data/raw/data-viz-2026/data/Unintentional_Injuries/Admissions.csv`

237,951 rows

| Column | Type | Distinct | Missing | Min | Max |
|---|---|---|---|---|---|
| Dataset | VARCHAR | 1 | 0 | Admissions | Admissions |
| Year Type | VARCHAR | 1 | 0 | Financial | Financial |
| Year | VARCHAR | 10 | 0 | 2015/16 | 2024/25 |
| AgeGroup | VARCHAR | 8 | 0 | 0-4 years | 75plus years |
| Sex | VARCHAR | 2 | 0 | Female | Male |
| InjuryLocation | VARCHAR | 12 | 0 | Farm | Unspecified place |
| InjuryType | VARCHAR | 7 | 0 | Crushing | Struck by, against |
| Number | BIGINT | 355 | 0 | 0 | 922 |
| HBR | VARCHAR | 14 | 0 | NHS Ayrshire and Arran | NHS Western Isles |
| CAName | VARCHAR | 32 | 0 | Aberdeen City | West Lothian |
| HSCPName | VARCHAR | 31 | 0 | Aberdeen City | Western Isles |

- **Dataset**: Admissions (237,951)

- **Year Type**: Financial (237,951)

- **Year**: 2015/16 (24,290), 2016/17 (24,311), 2017/18 (24,654), 2018/19 (24,234), 2019/20 (24,388), 2020/21 (22,106), 2021/22 (23,492), 2022/23 (23,128), 2023/24 (23,849), 2024/25 (23,499)

- **AgeGroup**: 0-4 years (20,377), 10-14 years (24,248), 15-24 years (28,721), 25-44 years (34,279), 45-64 years (37,163), 5-9 years (24,213), 65-74 years (33,355), 75plus years (35,595)

- **Sex**: Female (110,306), Male (127,645)

- **InjuryLocation**: Farm (6,454), Home (34,391), Industrial and construction area (6,321), Not Applicable (31,871), Other specified places (28,658), Residential Institute (11,991), School (22,897), Sports and athletics area (19,670), Street and highway (22,617), Trade and service area (17,724), Undisclosed (133), Unspecified place (35,224)

- **InjuryType**: Crushing (33,993), Falls (33,993), Other (33,993), Poisoning (33,993), RTI (33,993), Scalds (33,993), Struck by, against (33,993)

- **HBR**: NHS Ayrshire and Arran (23,184), NHS Borders (7,539), NHS Dumfries and Galloway (8,694), NHS Fife (9,520), NHS Forth Valley (20,286), NHS Grampian (24,031), NHS Greater Glasgow and Clyde (44,016), NHS Highland (15,092), NHS Lanarkshire (17,150), NHS Lothian (30,681), NHS Orkney (3,997), NHS Shetland (4,333), NHS Tayside (24,969), NHS Western Isles (4,459)


## injury_deaths: `data/raw/data-viz-2026/data/Unintentional_Injuries/Deaths.csv`

45,836 rows

| Column | Type | Distinct | Missing | Min | Max |
|---|---|---|---|---|---|
| Dataset | VARCHAR | 1 | 0 | Deaths | Deaths |
| Year Type | VARCHAR | 1 | 0 | Calendar | Calendar |
| Year | BIGINT | 10 | 0 | 2015 | 2024 |
| AgeGroup | VARCHAR | 8 | 0 | 0-4 years | 75plus years |
| Sex | VARCHAR | 2 | 0 | Female | Male |
| InjuryLocation | VARCHAR | 12 | 0 | Farm | Unspecified place |
| InjuryType | VARCHAR | 7 | 0 | Crushing | Struck by, against |
| Number | BIGINT | 62 | 0 | 0 | 97 |
| HBR | VARCHAR | 14 | 0 | NHS Ayrshire and Arran | NHS Western Isles |
| CAName | VARCHAR | 32 | 0 | Aberdeen City | West Lothian |
| HSCPName | VARCHAR | 31 | 0 | Aberdeen City | Western Isles |

- **Dataset**: Deaths (45,836)

- **Year Type**: Calendar (45,836)

- **Year**: 2015 (4,515), 2016 (4,634), 2017 (4,459), 2018 (4,382), 2019 (4,718), 2020 (4,655), 2021 (4,515), 2022 (4,515), 2023 (4,704), 2024 (4,739)

- **AgeGroup**: 0-4 years (497), 10-14 years (301), 15-24 years (4,102), 25-44 years (9,954), 45-64 years (10,745), 5-9 years (140), 65-74 years (7,371), 75plus years (12,726)

- **Sex**: Female (18,641), Male (27,195)

- **InjuryLocation**: Farm (238), Home (14,868), Industrial and construction area (343), Not applicable (8,505), Other specified places (3,486), Residential Institute (3,031), School (679), Sports and athletics area (63), Street and highway (581), Trade and service area (861), Undisclosed (147), Unspecified place (13,034)

- **InjuryType**: Crushing (6,548), Falls (6,548), Land transport accidents (6,548), Other (6,548), Poisoning (6,548), Scalds (6,548), Struck by, against (6,548)

- **HBR**: NHS Ayrshire and Arran (4,074), NHS Borders (1,463), NHS Dumfries and Galloway (1,617), NHS Fife (2,219), NHS Forth Valley (3,703), NHS Grampian (4,837), NHS Greater Glasgow and Clyde (8,582), NHS Highland (3,612), NHS Lanarkshire (4,088), NHS Lothian (5,894), NHS Orkney (455), NHS Shetland (462), NHS Tayside (4,242), NHS Western Isles (588)


## prescribing_a: `data/raw/data-viz-2026/data/Prescribing/File_A_2019-21.csv`

966,738 rows

| Column | Type | Distinct | Missing | Min | Max |
|---|---|---|---|---|---|
| PaidDateMonth | BIGINT | 36 | 0 | 201901 | 202112 |
| DispLocationCode | BIGINT | 1,399 | 0 | 1030 | 90204 |
| BNFChapter | BIGINT | 21 | 0 | 0 | 23 |
| Chapter Description | VARCHAR | 21 | 0 | ANAESTHESIA | STOMA APPLIANCES |
| NumberOfPaidItems | BIGINT | 4,481 | 0 | 1 | 6482 |
| PaidQuantity | DOUBLE | 138,257 | 0 | 1.0 | 889403.5 |
| GrossIngredientCost | DOUBLE | 512,736 | 0 | 0.0 | 385023.35 |
| DispLocationAddress1 | VARCHAR | 986 | 230,344 | 1 ALPIN ROAD | YELL HEALTH CENTRE |
| DispLocationAddress2 | VARCHAR | 659 | 231,010 | 1 CENTRE PARK COURT | WOODSIDE ROAD |
| DispLocationAddress3 | VARCHAR | 223 | 635,016 | (UNIT 4 CRADLEHALL SHOPPING CENTRE) | WISHAW |
| DispLocationAddress4 | VARCHAR | 66 | 891,298 | ABERDEEN | WIGTOWNSHIRE |
| DispLocationPostcode | VARCHAR | 1,023 | 229,605 | AB101HW | ZE2 9RW |
| HSCPName | VARCHAR | 31 | 229,605 | Aberdeen City | Western Isles |
| HBName | VARCHAR | 14 | 229,605 | NHS Ayrshire and Arran | NHS Western Isles |

- **BNFChapter**: 0 (47,944), 1 (48,354), 10 (48,351), 11 (48,324), 12 (48,294), 13 (48,345), 14 (23,103), 15 (46,698), 19 (39,608), 2 (48,344), 20 (48,203), 21 (48,630), 22 (39,725), 23 (44,710), 3 (48,347), 4 (48,353), 5 (48,349), 6 (48,344), 7 (48,319), 8 (48,077), 9 (48,316)

- **Chapter Description**: ANAESTHESIA (46,698), APPLIANCES (48,630), CARDIOVASCULAR SYSTEM (48,344), CENTRAL NERVOUS SYSTEM (48,353), DRESSINGS (48,203), EAR, NOSE AND OROPHARYNX (48,294), ENDOCRINE SYSTEM (48,344), EYE (48,324), GASTRO-INTESTINAL SYSTEM (48,354), IMMUNOLOGICAL PRODUCTS AND VACCINES (23,103), INCONTINENCE APPLIANCES (39,725), INFECTIONS (48,349), MALIGNANT DISEASE AND IMMUNOSUPPRESSION (48,077), MUSCULOSKELETAL AND JOINT DISEASES (48,351), Missing (47,944), NUTRITION AND BLOOD (48,316), OBSTETRICS, GYNAECOLOGY AND URINARY-TRAC (48,319), OTHER DRUGS AND PREPARATIONS (39,608), RESPIRATORY SYSTEM (48,347), SKIN (48,345), STOMA APPLIANCES (44,710)

- **HBName**: NHS Ayrshire and Arran (59,745), NHS Borders (19,649), NHS Dumfries and Galloway (22,500), NHS Fife (47,753), NHS Forth Valley (42,806), NHS Grampian (83,686), NHS Greater Glasgow and Clyde (155,421), NHS Highland (61,687), NHS Lanarkshire (79,447), NHS Lothian (89,875), NHS Orkney (3,582), NHS Shetland (6,366), NHS Tayside (57,399), NHS Western Isles (7,217), None (229,605)


## prescribing_b: `data/raw/data-viz-2026/data/Prescribing/File_B_2022-24.csv`

946,782 rows

| Column | Type | Distinct | Missing | Min | Max |
|---|---|---|---|---|---|
| PaidDateMonth | BIGINT | 36 | 0 | 202201 | 202412 |
| DispLocationCode | BIGINT | 1,603 | 0 | 1030 | 90204 |
| BNFChapter | BIGINT | 22 | 0 | 0 | 23 |
| Chapter Description | VARCHAR | 22 | 0 | ANAESTHESIA | STOMA APPLIANCES |
| NumberOfPaidItems | BIGINT | 4,741 | 0 | 1 | 11496 |
| PaidQuantity | DOUBLE | 175,740 | 0 | 0.0 | 3876282.0 |
| GrossIngredientCost | DOUBLE | 532,423 | 0 | 0.0 | 810280.28 |
| DispLocationAddress1 | VARCHAR | 1,212 | 124,878 | 1 ALPIN ROAD | YELL HEALTH CENTRE |
| DispLocationAddress2 | VARCHAR | 766 | 124,999 | 1 CENTRE PARK COURT | YOKER |
| DispLocationAddress3 | VARCHAR | 257 | 572,799 | (UNIT 4 CRADLEHALL SHOPPING CENTRE) | WISHAW |
| DispLocationAddress4 | VARCHAR | 74 | 863,658 | ABERDEEN | WIGTOWNSHIRE |
| DispLocationPostcode | VARCHAR | 1,254 | 124,149 | AB101HW | ZE2 9RW |
| HSCPName | VARCHAR | 31 | 124,149 | Aberdeen City | Western Isles |
| HBName | VARCHAR | 14 | 124,149 | NHS Ayrshire and Arran | NHS Western Isles |

- **BNFChapter**: 0 (46,582), 1 (48,237), 10 (48,224), 11 (48,185), 12 (48,184), 13 (48,219), 14 (9,274), 15 (47,184), 18 (2), 19 (37,105), 2 (48,235), 20 (47,663), 21 (48,503), 22 (39,389), 23 (44,591), 3 (48,233), 4 (48,257), 5 (48,228), 6 (48,215), 7 (48,195), 8 (47,872), 9 (48,205)

- **Chapter Description**: ANAESTHESIA (47,184), APPLIANCES (48,503), CARDIOVASCULAR SYSTEM (48,235), CENTRAL NERVOUS SYSTEM (48,257), DRESSINGS (47,663), EAR, NOSE AND OROPHARYNX (48,184), ENDOCRINE SYSTEM (48,215), EYE (48,185), GASTRO-INTESTINAL SYSTEM (48,237), IMMUNOLOGICAL PRODUCTS AND VACCINES (9,274), INCONTINENCE APPLIANCES (39,389), INFECTIONS (48,228), MALIGNANT DISEASE AND IMMUNOSUPPRESSION (47,872), MUSCULOSKELETAL AND JOINT DISEASES (48,224), Missing (46,582), NUTRITION AND BLOOD (48,205), OBSTETRICS, GYNAECOLOGY AND URINARY-TRAC (48,195), OTHER DRUGS AND PREPARATIONS (37,105), PREPARATIONS USED IN DIAGNOSIS (2), RESPIRATORY SYSTEM (48,233), SKIN (48,219), STOMA APPLIANCES (44,591)

- **HBName**: NHS Ayrshire and Arran (65,315), NHS Borders (20,110), NHS Dumfries and Galloway (26,102), NHS Fife (54,762), NHS Forth Valley (48,180), NHS Grampian (88,169), NHS Greater Glasgow and Clyde (173,050), NHS Highland (70,534), NHS Lanarkshire (90,665), NHS Lothian (106,756), NHS Orkney (3,556), NHS Shetland (6,284), NHS Tayside (61,961), NHS Western Isles (7,189), None (124,149)


## prescribing_c: `data/raw/data-viz-2026/data/Prescribing/File_C_2025-26.csv`

440,542 rows

| Column | Type | Distinct | Missing | Min | Max |
|---|---|---|---|---|---|
| PaidDateMonth | BIGINT | 17 | 0 | 202501 | 202605 |
| DispLocationCode | BIGINT | 1,373 | 0 | 1030 | 90204 |
| BNFChapter | BIGINT | 22 | 0 | 0 | 23 |
| Chapter Description | VARCHAR | 22 | 0 | ANAESTHESIA | STOMA APPLIANCES |
| NumberOfPaidItems | BIGINT | 4,402 | 0 | 1 | 17150 |
| PaidQuantity | DOUBLE | 137,633 | 0 | 0.0 | 2017403.0 |
| GrossIngredientCost | DOUBLE | 314,395 | 0 | 0.0 | 845767.97 |
| DispLocationAddress1 | VARCHAR | 1,251 | 8,195 | 1 ALPIN ROAD | YELL HEALTH CENTRE |
| DispLocationAddress2 | VARCHAR | 775 | 8,456 | 1 CENTRE PARK COURT | YOKER |
| DispLocationAddress3 | VARCHAR | 263 | 243,070 | (UNIT 4 CRADLEHALL SHOPPING CENTRE) | WISHAW |
| DispLocationAddress4 | VARCHAR | 75 | 397,378 | ABERDEEN | WIGTOWNSHIRE |
| DispLocationPostcode | VARCHAR | 1,291 | 7,847 | AB101HW | ZE2 9RW |
| HSCPName | VARCHAR | 31 | 7,847 | Aberdeen City | Western Isles |
| HBName | VARCHAR | 14 | 7,847 | NHS Ayrshire and Arran | NHS Western Isles |

- **PaidDateMonth**: 202501 (25,862), 202502 (25,786), 202503 (25,815), 202504 (25,850), 202505 (25,862), 202506 (25,857), 202507 (25,909), 202508 (25,882), 202509 (25,933), 202510 (26,020), 202511 (25,957), 202512 (25,988), 202601 (25,983), 202602 (25,929), 202603 (26,018), 202604 (25,956), 202605 (25,935)

- **BNFChapter**: 0 (21,190), 1 (22,590), 10 (22,586), 11 (22,568), 12 (22,558), 13 (22,590), 14 (2,436), 15 (22,184), 18 (1), 19 (17,369), 2 (22,585), 20 (22,209), 21 (22,676), 22 (18,083), 23 (20,993), 3 (22,583), 4 (22,590), 5 (22,579), 6 (22,585), 7 (22,558), 8 (22,446), 9 (22,583)

- **Chapter Description**: ANAESTHESIA (22,184), APPLIANCES (22,676), CARDIOVASCULAR SYSTEM (22,585), CENTRAL NERVOUS SYSTEM (22,590), DRESSINGS (22,209), EAR, NOSE AND OROPHARYNX (22,558), ENDOCRINE SYSTEM (22,585), EYE (22,568), GASTRO-INTESTINAL SYSTEM (22,590), IMMUNOLOGICAL PRODUCTS AND VACCINES (2,436), INCONTINENCE APPLIANCES (18,083), INFECTIONS (22,579), MALIGNANT DISEASE AND IMMUNOSUPPRESSION (22,446), MUSCULOSKELETAL AND JOINT DISEASES (22,586), Missing (21,190), NUTRITION AND BLOOD (22,583), OBSTETRICS, GYNAECOLOGY AND URINARY-TRAC (22,558), OTHER DRUGS AND PREPARATIONS (17,369), PREPARATIONS USED IN DIAGNOSIS (1), RESPIRATORY SYSTEM (22,583), SKIN (22,590), STOMA APPLIANCES (20,993)

- **HBName**: NHS Ayrshire and Arran (33,759), NHS Borders (10,251), NHS Dumfries and Galloway (14,160), NHS Fife (28,656), NHS Forth Valley (25,680), NHS Grampian (43,851), NHS Greater Glasgow and Clyde (91,893), NHS Highland (37,711), NHS Lanarkshire (47,994), NHS Lothian (58,129), NHS Orkney (1,996), NHS Shetland (3,231), NHS Tayside (32,018), NHS Western Isles (3,366), None (7,847)

