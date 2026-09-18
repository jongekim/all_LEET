# 기출문제 파일 등록 내역

원본 확인일: 2026-09-18. 아래는 확보한 원본 78개(PDF 50개·HWP 28개, 약 416 MB)의 보관 기록이다. 현재 서비스는 이 원본 경로 대신 [기출문제 Storage](past-exam-storage.md)의 워터마크 PDF 78개를 제공한다. 실제 원본은 `downloads/past-exams-original-archive/`에 보존한다.

## 자료 확보 및 확인

- 기존 PDF 38개: [다운로드 사이트](https://leet-calculator.site)의 기출문제 탭. `2025학년도 추리논증.pdf`는 실제 짝수형이다. 2027학년도 두 파일은 실제 단일 문형이며 기존 홀수형 표시를 바로잡았다.
- 기존 09예비 홀수형 PDF 2개: [유년기의 끝 공개 자료](https://suomessa.tistory.com/141).
- 추가한 문제지 **38개는 전부 [공식 LEET 자료실](https://leet.uwayapply.com/board/BoardList.htm?board_id=84)**에서 확보했다. 2022~2026학년도 10개는 PDF, 09예비~2021학년도 28개는 공식 HWP 원본이다. 각 파일의 `sourceUrl`은 실제 공식 게시물 주소이며 정답 첨부파일은 제외했다.
- PDF는 파싱 및 첫 페이지 렌더링으로 학년도·과목·유형을 확인했다. HWP는 OLE `FileHeader`와 `PrvText`의 학년도·과목·짝수형 표기를 확인했다. 아래 표는 서비스의 정적 원본 등록을 기록한다. 이후 별도로 만든 변환·워터마크 PDF의 업로드 내역은 [기출문제 Storage](past-exam-storage.md)에 기록한다. 같은 파일을 다른 유형으로 복제하지 않는다.
- 2027학년도는 공식 자료실에서 과목당 문제지 1개씩 공개하며 문형 표기가 없다. [단일 책형 전환 보도](https://www.lec.co.kr/news/articleView.html?idxno=752131)도 확인했다. 두 유형의 파일이 빠진 상태로 표시하지 않는다.
- 권리자: 법학전문대학원협의회. 화면에는 PDF 제공 및 저작권 안내를 표시하고 출처 링크는 표시하지 않는다. 확보 경위는 개발 문서에 보존한다.
- 다운로드 ZIP은 배포에 포함하지 않는다. HWP 파싱용 라이브러리는 검증 중 임시 경로에만 설치했으며 앱 의존성을 추가하지 않았다.

| 학년도 | 과목 | 문형 | 형식 | 서비스 경로 | SHA-256 |
|---|---|---|---|---|---|
| 09예비 | 언어이해 | 홀수형 | PDF | `/past-exams/2009-preliminary/verbal-odd-v1.pdf` | `1a6f2556454ddfb8ed926fd36c736883e7fe062ae96920da1d75bc79fe32f023` |
| 09예비 | 언어이해 | 짝수형 | HWP | `/past-exams/2009-preliminary/verbal-even-v1.hwp` | `ccd9fed1137c1056b8c6c0106c3fb94240ea0c7a5b593def96a7c5d7e6cf0959` |
| 09예비 | 추리논증 | 홀수형 | PDF | `/past-exams/2009-preliminary/reasoning-odd-v1.pdf` | `3c4bd946e512170b111839a1424d866066e9e78992d8f47da117d0ce6d6eda31` |
| 09예비 | 추리논증 | 짝수형 | HWP | `/past-exams/2009-preliminary/reasoning-even-v1.hwp` | `e768b9be141c293a2c88cd2a6c59fdbed65ab7f1e539132ca0808686105d2346` |
| 2009 | 언어이해 | 홀수형 | PDF | `/past-exams/2009/verbal-odd-v1.pdf` | `57c66e117ff8f8fd38eafce59355d4be103111c6bb0fa3390a009c41074a3d73` |
| 2009 | 언어이해 | 짝수형 | HWP | `/past-exams/2009/verbal-even-v1.hwp` | `da4b9085e77cd4fbd64bd7ee604175ddb529fa5df3c78961b8e7986e44311d3d` |
| 2009 | 추리논증 | 홀수형 | PDF | `/past-exams/2009/reasoning-odd-v1.pdf` | `d142a45f098999f1a6a78437a2677c00f4a20e11abd684bb8af5b3abc73a0072` |
| 2009 | 추리논증 | 짝수형 | HWP | `/past-exams/2009/reasoning-even-v1.hwp` | `1aa7e97af0509391fef6eb84eca87f43fbf33e90c0668b00dd3d6066ce8c3c3f` |
| 2010 | 언어이해 | 홀수형 | PDF | `/past-exams/2010/verbal-odd-v1.pdf` | `3efebb4681bf72b8da79d71c3893a8521e644ad39a89c770538b2dbde2f29110` |
| 2010 | 언어이해 | 짝수형 | HWP | `/past-exams/2010/verbal-even-v1.hwp` | `0e3b63ec1cd8fa5171102693e244d6749e5c7dbccef8091b680ab25d30510940` |
| 2010 | 추리논증 | 홀수형 | PDF | `/past-exams/2010/reasoning-odd-v1.pdf` | `5eb7b075e70e053a18b4392b08264287659d8b077e1336c01a3541d16a833c05` |
| 2010 | 추리논증 | 짝수형 | HWP | `/past-exams/2010/reasoning-even-v1.hwp` | `3938cbe24933f47262d6953666916e27c46d2a8dff14e9476426af2d959146bb` |
| 2011 | 언어이해 | 홀수형 | PDF | `/past-exams/2011/verbal-odd-v1.pdf` | `89c4a8ab2a42c1d6f341994b6c4d47cf542529e9b67c27934c9e8e050ef75b98` |
| 2011 | 언어이해 | 짝수형 | HWP | `/past-exams/2011/verbal-even-v1.hwp` | `31e940561dce1bccf6587c75859dda2bf5e0ac226de77711b7fd21982e814c5d` |
| 2011 | 추리논증 | 홀수형 | PDF | `/past-exams/2011/reasoning-odd-v1.pdf` | `4eb92309df9791d19a4e94990c1b80e6eb991b0529bbad2d2a559e4201d11d4d` |
| 2011 | 추리논증 | 짝수형 | HWP | `/past-exams/2011/reasoning-even-v1.hwp` | `90fcc381293db059af2235195aed1742c86d6c8826350ff32eaec51bdf1573e6` |
| 2012 | 언어이해 | 홀수형 | PDF | `/past-exams/2012/verbal-odd-v1.pdf` | `fbe94b9726a6814cc3e00e0bedc084309f28981d39705ac1b87812c47e9f6ba2` |
| 2012 | 언어이해 | 짝수형 | HWP | `/past-exams/2012/verbal-even-v1.hwp` | `f149cd9d6f9e6d87e9a24a8f41d8a9189a7de81284dec12001149ded52885d2f` |
| 2012 | 추리논증 | 홀수형 | PDF | `/past-exams/2012/reasoning-odd-v1.pdf` | `b62e49a5293f32d495873b5eaa2a2a58e9b5c97531331da92e756f3d27c0a6e1` |
| 2012 | 추리논증 | 짝수형 | HWP | `/past-exams/2012/reasoning-even-v1.hwp` | `ff4681cbd5d67ddeff90c7baf6082c5d8b6fdaeb2f2caa7c6db8cf910aff95fb` |
| 2013 | 언어이해 | 홀수형 | PDF | `/past-exams/2013/verbal-odd-v1.pdf` | `ff6e2d4590df17a320bf375b66965af0e085a061bd496d35d3b1924ed901009f` |
| 2013 | 언어이해 | 짝수형 | HWP | `/past-exams/2013/verbal-even-v1.hwp` | `f861593f79de7843ed5727de50afc4f4ea6e0fffcb660c01da52db03935bbea8` |
| 2013 | 추리논증 | 홀수형 | PDF | `/past-exams/2013/reasoning-odd-v1.pdf` | `808afd5245e84dac5a1c3a0c3566aadaba70fcb903b6285c669bb66c7eeadab5` |
| 2013 | 추리논증 | 짝수형 | HWP | `/past-exams/2013/reasoning-even-v1.hwp` | `1d7ae64e7c9cc2f4bc193e92767d036f82eb2a99fb25ea0b1ebda6da22b20211` |
| 2014 | 언어이해 | 홀수형 | PDF | `/past-exams/2014/verbal-odd-v1.pdf` | `f59e775c6f6a30b3e83327f8656ec19729fde745615646274e1345a8235f83e9` |
| 2014 | 언어이해 | 짝수형 | HWP | `/past-exams/2014/verbal-even-v1.hwp` | `f75f0937b735e97bc6cf8c10c332418114a61cbcbf46d8471e9225988e49839b` |
| 2014 | 추리논증 | 홀수형 | PDF | `/past-exams/2014/reasoning-odd-v1.pdf` | `09993bcf74ffe33680c76b0b46d865850de8321f0517bfbd6c6a31870abce57e` |
| 2014 | 추리논증 | 짝수형 | HWP | `/past-exams/2014/reasoning-even-v1.hwp` | `2c215f03c963212d5accbe03da62ba4e63e4d36e49470a57b6c9c6d10bb5d3a7` |
| 2015 | 언어이해 | 홀수형 | PDF | `/past-exams/2015/verbal-odd-v1.pdf` | `16172a53c05f317f4a4fdf77640abc491cb02427102d5e3af424d7d44578e244` |
| 2015 | 언어이해 | 짝수형 | HWP | `/past-exams/2015/verbal-even-v1.hwp` | `50cf8f3ee75c6bbd7082b417cfcabb813e1836ab96c8080fe998df2d2e21fc0b` |
| 2015 | 추리논증 | 홀수형 | PDF | `/past-exams/2015/reasoning-odd-v1.pdf` | `df3685ce94e4ed182bd102f59c11851308a867659d38daacaa53843476eec79f` |
| 2015 | 추리논증 | 짝수형 | HWP | `/past-exams/2015/reasoning-even-v1.hwp` | `81d78d0aec564f8ee7a9be0520d2698a248ce5fc23043bc619e3e5a298e6fd15` |
| 2016 | 언어이해 | 홀수형 | PDF | `/past-exams/2016/verbal-odd-v1.pdf` | `64237423a853711ac40eaf11fec0e011edc444073183cbb164e43e5018397769` |
| 2016 | 언어이해 | 짝수형 | HWP | `/past-exams/2016/verbal-even-v1.hwp` | `f6defa066b2f3bd806480edf2e75a4bfd8673bd356cafc6d9ed1b7e0d630dd94` |
| 2016 | 추리논증 | 홀수형 | PDF | `/past-exams/2016/reasoning-odd-v1.pdf` | `02dab2993c2dd67a8951a8ce5e70b196e0a2512ae817665746b603842254b6d4` |
| 2016 | 추리논증 | 짝수형 | HWP | `/past-exams/2016/reasoning-even-v1.hwp` | `5a6757fbafab48081bdb65a9a8d03aec4ebf47ae78b4b1db924e8b23ab99931f` |
| 2017 | 언어이해 | 홀수형 | PDF | `/past-exams/2017/verbal-odd-v1.pdf` | `bd51f5e4512c023f40944bb69a5bb184de866bbc098ecdbb7fe2e02292802c21` |
| 2017 | 언어이해 | 짝수형 | HWP | `/past-exams/2017/verbal-even-v1.hwp` | `3ae1167b7918653bee07bcdbe8f8239f74f7346d1ca427abad326dd6687c727b` |
| 2017 | 추리논증 | 홀수형 | PDF | `/past-exams/2017/reasoning-odd-v1.pdf` | `8bfa8005546816176bee5852edef713d1eb7d1c1bd81315597f65e7b7c96ef27` |
| 2017 | 추리논증 | 짝수형 | HWP | `/past-exams/2017/reasoning-even-v1.hwp` | `9dbeba801c269a7456081c5d144a88e58481953f764105240b1ad93079fad7f9` |
| 2018 | 언어이해 | 홀수형 | PDF | `/past-exams/2018/verbal-odd-v1.pdf` | `36a4597f0f8ab314175edcab6f456b1a203f4910cb71d64889898d40ec87a471` |
| 2018 | 언어이해 | 짝수형 | HWP | `/past-exams/2018/verbal-even-v1.hwp` | `0efc0b5fbd2a385d13e463e616c1664e986201281898b123debec5dfd250bf34` |
| 2018 | 추리논증 | 홀수형 | PDF | `/past-exams/2018/reasoning-odd-v1.pdf` | `bb448f378638d64f4c97fe61cfffd6253a6a51c225c9c908dd64a40dd7530db4` |
| 2018 | 추리논증 | 짝수형 | HWP | `/past-exams/2018/reasoning-even-v1.hwp` | `fbe8be6bbf5d97fa821bcb8b89d0e1e7e031fa4d9500c0aca6301e504a754e43` |
| 2019 | 언어이해 | 홀수형 | PDF | `/past-exams/2019/verbal-odd-v1.pdf` | `9c9e729c10ddbfe9930f95318f1d2b271d05e29e2b4acbe8cb81e703bdea02dd` |
| 2019 | 언어이해 | 짝수형 | HWP | `/past-exams/2019/verbal-even-v1.hwp` | `5f260b57df64ed2c7b44c5f197b39b69fbad3fe31a531647b3919a9cdd385298` |
| 2019 | 추리논증 | 홀수형 | PDF | `/past-exams/2019/reasoning-odd-v1.pdf` | `08714d26c73ff8528b1dc81b2a419f5ba15475d6e3942ced9f0638020234675c` |
| 2019 | 추리논증 | 짝수형 | HWP | `/past-exams/2019/reasoning-even-v1.hwp` | `e135421ef67972a3a3be55333446f02e46f45a6a29e2ec207d80fa47950775c3` |
| 2020 | 언어이해 | 홀수형 | PDF | `/past-exams/2020/verbal-odd-v1.pdf` | `e4edef37a99c40cf4f70e1d8ea21c8d316dc9e9b68c156320c0ae02b301b672b` |
| 2020 | 언어이해 | 짝수형 | HWP | `/past-exams/2020/verbal-even-v1.hwp` | `6b207e583f7f5ee7af6339e53433a926767fc704043af458449d5a1ad54b2f5c` |
| 2020 | 추리논증 | 홀수형 | PDF | `/past-exams/2020/reasoning-odd-v1.pdf` | `d6f972e1946a717bbf57c33866eca155ee07cee689364083ee9dc59009887d17` |
| 2020 | 추리논증 | 짝수형 | HWP | `/past-exams/2020/reasoning-even-v1.hwp` | `2be49eee775b245b52deea12331333f7fece2be93892a1d6b54944a3911e48f0` |
| 2021 | 언어이해 | 홀수형 | PDF | `/past-exams/2021/verbal-odd-v1.pdf` | `1546be53599cc186a970ff22fee85b5721e9954acb334cd83b06df74a2f17247` |
| 2021 | 언어이해 | 짝수형 | HWP | `/past-exams/2021/verbal-even-v1.hwp` | `4c9e2621763b670a8856295b2b24a122a597af46d619c10386d23664d1d0dcc1` |
| 2021 | 추리논증 | 홀수형 | PDF | `/past-exams/2021/reasoning-odd-v1.pdf` | `aa296ae20018d9f16f48898082f8627edad1e0e512c64a27ec86f31cb2d03b8b` |
| 2021 | 추리논증 | 짝수형 | HWP | `/past-exams/2021/reasoning-even-v1.hwp` | `b1019aedf92f0b12f5edb672f2f30f16fcfe93bb67157640edefe92020061e21` |
| 2022 | 언어이해 | 홀수형 | PDF | `/past-exams/2022/verbal-odd-v1.pdf` | `e00f065644591dcd965a6439c3119906e3106bd4bdd4354ac158b6cae9ef4077` |
| 2022 | 언어이해 | 짝수형 | PDF | `/past-exams/2022/verbal-even-v1.pdf` | `f9713a4f353fb319a99c34b5d9d0b23c5d1b1dabe9e898e8ca9bb4c215302539` |
| 2022 | 추리논증 | 홀수형 | PDF | `/past-exams/2022/reasoning-odd-v1.pdf` | `310efdab1e261fdfaad858ee226711ccb4ef176ea7f0d57a0716c88945a67c9c` |
| 2022 | 추리논증 | 짝수형 | PDF | `/past-exams/2022/reasoning-even-v1.pdf` | `b65660b5416991083b15196b7ef1c98c6710c6717294f2ed103cbf5f68203d51` |
| 2023 | 언어이해 | 홀수형 | PDF | `/past-exams/2023/verbal-odd-v1.pdf` | `97e2645c41f96f7efcf59da623662124ad4facfae77d49d203a2945ca3cc9efb` |
| 2023 | 언어이해 | 짝수형 | PDF | `/past-exams/2023/verbal-even-v1.pdf` | `988c6c0623cc04fb1bbcdd887668529b51f5c13261f1a026b86921c9baa23737` |
| 2023 | 추리논증 | 홀수형 | PDF | `/past-exams/2023/reasoning-odd-v1.pdf` | `a54c7994447a0f41d93a5f88335b4384d54abcd32f12d6dffd8ca17bdc8bc91b` |
| 2023 | 추리논증 | 짝수형 | PDF | `/past-exams/2023/reasoning-even-v1.pdf` | `9cadb2768a4a3754dacf600f016a68b058d5be26d03bd98a1af6558fc22e26cb` |
| 2024 | 언어이해 | 홀수형 | PDF | `/past-exams/2024/verbal-odd-v1.pdf` | `6433fdbeafa147d4478559fc617719cd07b60533fc910b2b4b4a3834eee9cfda` |
| 2024 | 언어이해 | 짝수형 | PDF | `/past-exams/2024/verbal-even-v1.pdf` | `12f47a3fc17c134a6311a1b6315a0bbf04e43870e893f1b6af43a8767e2ca9bd` |
| 2024 | 추리논증 | 홀수형 | PDF | `/past-exams/2024/reasoning-odd-v1.pdf` | `cd23dc64ad29160e530c942980a2504d7b8ae3d2e0bd1af11a95968ef28ed97d` |
| 2024 | 추리논증 | 짝수형 | PDF | `/past-exams/2024/reasoning-even-v1.pdf` | `d5b20133af593100b9a47fff40105ebe02f65d7678d6422ecaa29b51337532ad` |
| 2025 | 언어이해 | 홀수형 | PDF | `/past-exams/2025/verbal-odd-v1.pdf` | `4cc806c4725b69729aca983e32d99f66f22e17e65356fd29cfc3460ff9f0118b` |
| 2025 | 언어이해 | 짝수형 | PDF | `/past-exams/2025/verbal-even-v1.pdf` | `9bf4120878f6c4026b8b19f06281130199f41c484765e37af2e2df618526a41f` |
| 2025 | 추리논증 | 홀수형 | PDF | `/past-exams/2025/reasoning-odd-v1.pdf` | `e3072392fc6d61d534ce14ae8e6d2d494e16512e628a2464c302a1d22d536d51` |
| 2025 | 추리논증 | 짝수형 | PDF | `/past-exams/2025/reasoning-even-v1.pdf` | `c97a6adf3f36f4e830ea927079f6bda22ebc5de066d5257d9a33c73ccc87ebd5` |
| 2026 | 언어이해 | 홀수형 | PDF | `/past-exams/2026/verbal-odd-v1.pdf` | `a3f191f3893ed6a234776c50d3664710a8f3ff9e5ed9316cd6b9d6b53b8be99b` |
| 2026 | 언어이해 | 짝수형 | PDF | `/past-exams/2026/verbal-even-v1.pdf` | `cedcf15296f70d49cd707220e7d5aa9504477091e32d3b34545d150fdd1a71fb` |
| 2026 | 추리논증 | 홀수형 | PDF | `/past-exams/2026/reasoning-odd-v1.pdf` | `b8446d779bbb9813da977ebc836464b909e830056d1ac8cc80c4e825b118b650` |
| 2026 | 추리논증 | 짝수형 | PDF | `/past-exams/2026/reasoning-even-v1.pdf` | `f327d917f5c27fbedccf27fc7f4aca5b33dfafb948e31c27b1b40fe308ee9244` |
| 2027 | 언어이해 | 단일 문형 | PDF | `/past-exams/2027/verbal-single-v1.pdf` | `3bf63127d89645232e9f5372247eaff000c9afdc3f2507ca81902f91db556140` |
| 2027 | 추리논증 | 단일 문형 | PDF | `/past-exams/2027/reasoning-single-v1.pdf` | `6b77a96b185f6b442225195c64243171ab48b22595e637e741a3bd4a49400e15` |
