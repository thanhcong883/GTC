# Agent-Native Browser — Study Edition (VI)

**Thuật ngữ giữ nguyên tiếng Anh. Giải thích bằng tiếng Việt. Mỗi khái niệm có đối chiếu với thứ đã tồn tại thật, kèm nguồn.**

Bản submission tiếng Anh: [agent-native-browser.md](agent-native-browser.md). Bản này không phải bản dịch — nó là bản *học*: dạy thuật ngữ, và neo mỗi ý tưởng vào một thứ có thật ngoài đời để bạn biết chỗ nào là thiết kế của mình, chỗ nào là thứ ngành đã làm rồi.

Ngày tra cứu: **2026-08-03**.

---

## Phần 0 — Điều quan trọng nhất tôi học được khi tra

Trước khi tra, tài liệu là lập luận thuần từ nguyên lý. Sau khi tra, phát hiện lớn nhất là:

> **Phần lớn thứ tôi tưởng mình đang thiết kế thì đã tồn tại, đã có tên riêng, và một số đã chạy production.**

Đây là tin tốt, không phải tin xấu. Một bản thiết kế **ánh xạ được** vào các chuẩn đang triển khai thì đáng tin; một bản tự chế từ vựng song song thì trông ngây thơ. Việc cần làm không phải đổi thiết kế, mà là **gọi đúng tên** và trích nguồn.

---

## Phần 1 — Đối chiếu: thiết kế ↔ thứ đã có thật

Đây là bảng quan trọng nhất của bản study. Cột trái là thuật ngữ trong bài; cột giữa là thứ tương ứng ngoài đời; cột phải là mức độ trưởng thành.

| Thuật ngữ trong bài | Đã tồn tại dưới tên | Trạng thái |
|---|---|---|
| **Native agent contract** (site khai báo typed action) | **WebMCP** — `document.modelContext` | W3C Community Group Draft 28/07/2026; Chrome origin trial |
| **Effect broker / sealed reference** (agent không thấy credential) | **Shared Payment Token (SPT)** trong **ACP** | Production — OpenAI + Stripe, Apache 2.0, 29/09/2025 |
| **Approval bound to exact terms hash** | **Cart Mandate** trong **AP2** | Spec mở, 60+ đối tác thanh toán, 16/09/2025 |
| **Delegation chain** (principal → delegate → runtime) | **Intent / Cart / Payment Mandate** (AP2) | Như trên |
| **Declared delegate identity** (site biết agent là ai) | **Web Bot Auth** — HTTP Message Signatures (RFC 9421), header `Signature-Agent` | IETF WG chartered 2026; Cloudflare Verified Bots |
| **Z2/Z3 split** (planner untrusted, enforcement ngoài model) | **CaMeL** — Privileged LLM / Quarantined LLM + interpreter | Nghiên cứu, arXiv 2503.18813, mã nguồn mở |
| **Attenuated grant** (quyền con ⊆ quyền cha) | **Macaroons** — caveats + attenuation | Google Research, NDSS 2014; đã triển khai |
| **`idempotency: site_enforced`** | **`Idempotency-Key` header** của Stripe | Production, cache 24h |
| **Machine-readable refusal** | Ba lớp crawler của Cloudflare + Pay Per Use | Hiệu lực 15/09/2026 |

### Giải thích từng dòng

**WebMCP** — `document.modelContext` là một browser API mới cho phép **website tự khai báo** những việc nó làm được, dưới dạng tool có tham số rõ ràng, thay vì bắt agent chụp màn hình rồi đoán chỗ bấm. Đây chính xác là "native path" trong bài. Do kỹ sư Google và Microsoft khởi xướng, phát triển trong W3C Web Machine Learning Community Group. Current draft (28/07/2026) mở rộng `Document`; phương thức là `registerTool()` và `getTools()`.

> ⚠️ **Bài học về nguồn, ghi lại vì tôi đã mắc.** Tôi trích `/docs/proposal.html` — một explainer snapshot cũ vẫn dùng `navigator.modelContext` — và bảo vệ nó trước một phản biện đúng. API đã chuyển từ `Navigator` sang `Document`, và Chrome ghi rõ *"`navigator.modelContext` is deprecated in Chrome 150."*
>
> Thứ tự ưu tiên nguồn phải là: **current dated specification → browser implementation docs → implementation status → old proposal/explainer.** Với một API đang phát triển nhanh, hai trang cùng tồn tại trên cùng một domain có thể phản ánh hai thời điểm khác nhau. "Đây là trang chính thức" chưa đủ — phải hỏi *chính thức tính đến ngày nào*.

*Lưu ý về chất lượng nguồn:* nhiều blog trích các con số kiểu "89% token savings", "67% fewer errors" — tôi **không dùng** những số này vì không truy được về nguồn sơ cấp.

**ACP + Shared Payment Token** — điều đáng chú ý: mô tả chính thức nói agent **không bao giờ thấy raw card details**, và token chỉ được authorize cho **một số tiền cụ thể với một merchant cụ thể**. Đó đúng từng chữ là `sealed_reference` + `spend_ceiling` + `merchant lock` trong bài. Không phải tôi nghĩ ra — Stripe và OpenAI đã ship nó từ tháng 9/2025.

**AP2 và ba mandate** — AP2 dùng **cryptographically signed mandates** làm bằng chứng người dùng đã cho phép: `Intent Mandate` (ủy quyền mục tiêu) → `Cart Mandate` (duyệt đúng giỏ hàng với đúng giá) → `Payment Mandate` (credential dẫn xuất mà mạng thanh toán nhìn thấy). Ba tầng consent này chính là thứ tôi lập luận ở mục liability: *cấp quyền kỹ thuật ≠ duyệt mục tiêu ≠ duyệt một lựa chọn cụ thể*. AP2 chuẩn hóa nó và — quan trọng — **không tự chuyển tiền**, nó chỉ tạo bằng chứng có thể verify để rail nào cũng settle được.

**Web Bot Auth** — mỗi agent có một khóa Ed25519, ký request bằng HTTP Message Signatures (RFC 9421), gắn header `Signature-Agent`, công bố khóa qua JWKS directory. Cloudflare, Amazon, Akamai, OpenAI hậu thuẫn.

Bằng chứng mạnh nhất cho luận điểm CAPTCHA của tôi nằm ở tiêu đề một trang tài liệu của AWS: **"Reducing CAPTCHAs with Web Bot Auth"**. Nghĩa là ngành đã đi đúng hướng "thay câu đố bằng định danh" mà bài dự đoán.

**CaMeL** — bài của DeepMind, tên đầy đủ *Defeating Prompt Injections by Design*. Kiến trúc: một **Privileged LLM** sinh kế hoạch từ truy vấn tin cậy, một **Quarantined LLM** xử lý dữ liệu bẩn **không có quyền gọi tool**, và một **custom interpreter** theo dõi provenance rồi cưỡng chế policy trước mỗi lần gọi tool. Guarantee cốt lõi theo abstract: *"dữ liệu bẩn mà LLM lấy về không bao giờ ảnh hưởng được program flow"*.

Đây là **Authority Monotonicity** của bài, đã được viết thành paper và có mã nguồn mở. Nếu viết bài mà không trích CaMeL thì bạn đang phát minh lại một thứ đã có tên.

**Macaroons** — credential mang theo **caveats** làm hẹp dần điều kiện sử dụng: khi nào, ở đâu, bởi ai, cho mục đích gì. Điểm hay nhất và ít người biết: **client cũng thêm được caveat**, tức là bên giữ credential tự làm yếu credential của mình đi trước khi trao cho bên khác. Đó chính là `Capabilities(child) ⊆ Capabilities(parent)`.

---

## Phần 2 — Từ điển thuật ngữ

### Ba định luật

| Term | Tiếng Việt | Nghĩa |
|---|---|---|
| **Enforcement boundary** | ranh giới cưỡng chế | Một thành phần chỉ bảo đảm được thuộc tính nằm trong vùng trạng thái nó kiểm soát |
| **Oracle dependency** | phụ thuộc nguồn sự thật | Quyết định policy chỉ đáng tin bằng oracle cấp fact cho nó |
| **Authority monotonicity** | tính đơn điệu của quyền | `Authority(sau khi đọc web) ⊆ Authority(trước khi đọc web)` |

**Oracle** — dịch sát là "nguồn phán sự thật". Trong bài nó là *thành phần nào nói cho reference monitor biết hành động này sẽ gây ra chuyện gì*. Ví dụ: DOM nói giá 2,49 triệu — DOM là oracle yếu, do đối thủ kiểm soát. Payment rail thấy số tiền authorization thật — oracle mạnh, độc lập với HTML.

**Reference monitor** — thuật ngữ an ninh cổ điển: thành phần trung gian **mọi** truy cập, không thể bị sửa từ bên trong, đủ nhỏ để kiểm chứng được. Trong bài nó nằm ở Z3, ngoài model.

### Hai ngân sách

| Term | Tiếng Việt | Nghĩa |
|---|---|---|
| **Attention budget** | ngân sách chú ý | Số lần được phép làm phiền con người trong một khoảng thời gian |
| **Leak budget** | ngân sách rò rỉ | Trần entropy được phép chảy ra ngoài trong một task |

### Năm trục

| Term | Tiếng Việt | Nghĩa |
|---|---|---|
| **Semantic state / state delta** | trạng thái ngữ nghĩa / sai phân trạng thái | Gửi *thay đổi* thay vì chụp lại toàn trang |
| **Semantic handle** | tham chiếu ngữ nghĩa | Tham chiếu tới một phần tử, chỉ sống trong một `state_version` |
| **Entity reconciliation** | đối chiếu thực thể | Nhận lại đúng đối tượng sau khi trang re-render |
| **Fail closed** | hỏng theo hướng an toàn | Không chắc thì báo lỗi, không đoán bừa |
| **Quiescence** | trạng thái tĩnh | Trang "đã xong" — thực tế không tồn tại phổ quát |
| **Readiness predicate** | điều kiện sẵn sàng | Thay `sleep()`: chờ *điều kiện cho bước tiếp theo*, không chờ cả trang |
| **Effect lease** | quyền độc chiếm hiệu ứng | Chỉ một nhánh speculative được phép gây tác dụng ra ngoài |
| **TOCTOU** | *time-of-check to time-of-use* | Khoảng hở giữa lúc kiểm tra và lúc dùng — giá đổi ở đúng khoảng này |
| **Conditional commit** | commit có điều kiện | Server kiểm điều kiện và tạo đơn trong **cùng một transaction** |
| **Idempotency key** | khóa chống lặp | Cùng key → cùng kết quả, retry không tạo đơn thứ hai |
| **Declassification** | giải mật | Cho phép dữ liệu từ vùng bẩn đi ra ngoài, có kiểm soát |
| **Sink** | đầu ra | Nơi dữ liệu thoát ra ngoài (một trường form, một request) |
| **Provenance** | nguồn gốc | Claim này biết được bằng cách nào |
| **Assurance** | mức bảo đảm | Claim này chắc tới đâu, ai cưỡng chế |
| **Dispute bundle** | hồ sơ tranh chấp | Trace dùng làm bằng chứng, không phải log để debug |
| **Consent epoch** | kỷ nguyên đồng ý | Phiên bản bối cảnh mà một grant gắn vào |

### Bảy lớp value provenance

Dùng cho từng trường trong một action:

| Class | Tiếng Việt | Cho phép ở đâu |
|---|---|---|
| `destination_selection` | chọn từ danh sách chính site đích công bố | Rộng rãi |
| `approved_constant` | hằng số đã chốt trong grant, trước khi đọc web | Cho phép |
| `user_supplied` | do người dùng đưa | Cho phép |
| `sealed_reference` | handle mờ, broker giải ra lúc dispatch | Cho phép; planner không thấy plaintext |
| `deterministic_derivation` | hàm thuần từ input hợp lệ, runtime tính lại được | Cho phép, ghi lại công thức |
| `model_composed` | planner tự soạn chuỗi | Tùy sink, có trần độ dài và tần suất |
| `cross_origin_derived` | chịu ảnh hưởng từ origin khác đích đến | Chặn mặc định |

---

## Phần 3 — Số liệu có nguồn

Dùng những con số này thay cho lập luận cảm tính. Tôi ghi rõ chỗ nào **tôi đã suýt trích sai** trước khi kiểm chứng.

| Số | Nội dung | Nguồn |
|---|---|---|
| **70,2%** | Tỉ lệ người dùng bấm qua cảnh báo SSL của Chrome | Akhawe & Felt, USENIX Security 2013 |
| **~33%** | Tỉ lệ tương tự trên Firefox | Cùng nguồn |
| **10% / 25%** | Bấm qua cảnh báo malware-phishing (Firefox / Chrome) | Cùng nguồn |
| **25 triệu** | Số màn cảnh báo được phân tích, 05–06/2013 | Cùng nguồn |
| **77% vs 84%** | CaMeL giải được 77% task AgentDojo **với provable security**, so với baseline không phòng thủ 84% | CaMeL abstract, arXiv 2503.18813 |
| **97 / 629** | AgentDojo: 97 user task, 629 security case | AgentDojo, OpenReview |
| **65,7% / 30,8%** | Prompt sandwiching: utility-under-attack 65,7% nhưng attack success rate vẫn 30,8% | AgentDojo |
| **24 giờ** | Thời gian Stripe cache kết quả theo `Idempotency-Key` | Stripe |
| **10–20 triệu USD/năm, 3–4 năm** | Chi phí một ngân hàng tự xây API | Plaid |
| **80%** | Tỉ lệ traffic Plaid đã chuyển sang API thay vì screen scraping | Plaid |
| **15/09/2026** | Ngày chính sách crawler mới của Cloudflare có hiệu lực | TechCrunch |

### ⚠️ Hai chỗ tôi suýt trích sai

**1. CaMeL — không phải 67%.** Kết quả tìm kiếm nói "67% of tasks with provable security". Đọc abstract gốc thì là **77%, so với baseline 84%**. Khác biệt rất lớn về ý nghĩa: cái giá của provable security là khoảng **7 điểm phần trăm utility**, không phải 17. Con số đúng làm luận điểm *mạnh hơn* — bảo đảm chứng minh được rẻ hơn ta tưởng.

**2. Cloudflare — không phải "chặn agent bot".** Nhiều bài tóm tắt viết "agent và training bots bị chặn mặc định". Đọc bài TechCrunch thì chính xác hơn: thứ bị chặn mặc định trên trang có quảng cáo là **mixed-use crawler** — loại trộn lẫn search, agent và training. Crawler chỉ-search và crawler agent-chuyên-biệt thì **được cho qua**.

Điều này còn hay hơn: nó không phải lệnh cấm agent, nó là **áp lực buộc tách định danh**. Công ty AI phải tách rõ crawler nào làm việc gì, nếu không thì bị chặn. Đúng luận điểm "declared delegate identity" của bài, nhưng đang xảy ra vì lý do kinh tế chứ không vì lý do an ninh.

*Bài học phương pháp: đừng trích từ snippet tìm kiếm. Snippet sai cả hai lần.*

---

## Phần 4 — Bốn chỗ nghiên cứu làm thay đổi thiết kế

### 4.1 Prompt injection: giả định "planner đã bị chiếm" không còn là phòng xa

Bài giả định planner **có thể đã bị chiếm quyền**. Nhiều người sẽ thấy đó là bi quan quá mức. Bằng chứng nói ngược lại:

- **08/2025** — đội bảo mật Brave giấu chữ trong một Reddit spoiler tag; Comet đọc, làm theo, và **lấy ra email cùng mã OTP** của người dùng.
- **03/2026** — Zenity Labs công bố họ lỗ hổng tên **"PleaseFix"**: chiếm quyền agent **zero-click** qua lời mời lịch, và một vector rút credential từ 1Password. Agent đổi được cả mật khẩu trong khi người dùng chỉ thấy output vô hại.
- **OpenAI** nói thẳng prompt injection **có thể sẽ không bao giờ được "giải quyết"** cho browser agent như Atlas.

Nhà nghiên cứu Stav Cohen gọi cơ chế gốc là **"intent collision"** — khoảnh khắc agent trộn chỉ thị hợp lệ của người dùng với nội dung do kẻ tấn công kiểm soát thành **một kế hoạch duy nhất**, và không còn cách nào phân biệt.

> Dùng thuật ngữ này trong bài. Nó gọn hơn cả đoạn tôi viết, và nó có tác giả.

### 4.2 Warning fatigue phức tạp hơn tôi lập luận — theo hướng có lợi

Tôi lập luận: hỏi duyệt quá nhiều → người ta bấm bừa → approval mất tác dụng làm security boundary. Số liệu Akhawe & Felt ủng hộ: **70,2%** bấm qua cảnh báo SSL của Chrome.

Nhưng cùng nghiên cứu đó cho thấy cảnh báo malware/phishing chỉ bị bấm qua **10% (Firefox) và 25% (Chrome)** — và các tác giả kết luận rằng cảnh báo **có thể hiệu quả trên thực tế**.

Nghĩa là kết luận đúng không phải "con người luôn bấm bừa", mà:

> Cảnh báo trình bày kém và xuất hiện thường xuyên thì bị bỏ qua; cảnh báo hiếm và trình bày rõ thì được đọc. **Chênh lệch 7 lần** giữa hai loại.

Điều này **tinh chỉnh** Attention Budget của tôi thay vì chỉ xác nhận nó. Mục tiêu không chỉ là *giảm số lần hỏi* mà là *giảm số lần hỏi **và** nâng chất lượng trình bày*. Nó biện minh trực tiếp cho thiết kế "approval UI làm nổi bật chỗ bất đồng" — đó chính là biến một cảnh báo kiểu SSL thành một cảnh báo kiểu phishing.

### 4.3 Kinh tế không còn là suy đoán — nó có ngày hiệu lực

Mục "Incentives and liability" của bài viết ở thì tương lai. Không cần nữa:

- **15/09/2026** (còn khoảng sáu tuần kể từ hôm nay): mặc định của Cloudflare chặn mixed-use crawler trên trang có quảng cáo.
- **Pay Per Crawl → Pay Per Use**: publisher được trả tiền khi nội dung **được dùng trong câu trả lời**, không phải khi bot tải trang.

Chuyển từ "tính tiền theo lượt fetch" sang "tính tiền theo lượt tạo ra giá trị" đúng là điều bài dự đoán: mô hình **viewability** chết, mô hình khác thay thế. Giờ nó có tên và có ngày.

### 4.4 Chi phí của native path có con số — và nó xác nhận một tác hại tôi tự nêu

Mục "What this design makes worse" của tôi có một dòng: *native protocol có xu hướng đẩy site nhỏ vào hạng `inferred` vĩnh viễn*. Đó là suy đoán. Giờ có số:

Plaid ước tính một ngân hàng **tự xây API** mất **3–4 năm** và **10–20 triệu USD mỗi năm**. Tổ chức lớn có thể chịu; phần lớn tổ chức nhỏ thì không.

Đây là bằng chứng trực tiếp cho tác hại đó, trong một ngành **đã đi trước** con đường mà agent web đang đi. Và chi tiết bổ sung: **80%** traffic của Plaid nay đã chạy trên API thay vì screen scraping — tức là con đường từ legacy sang native **đi được**, nhưng mất hơn một thập kỷ và cần áp lực pháp lý.

> Đây là điểm mạnh nhất bạn có thể thêm vào bài: **open banking là bản diễn tập của agent web.** Cùng một hình dạng bài toán — scraping bằng credential người dùng, rồi chuyển dần sang API có định danh và có hợp đồng — chỉ khác là ngành tài chính đã đi trước mười năm và ta biết nó kết thúc ra sao.

---

## Phần 5 — Cách dùng nguồn khi viết bài

Ba nguyên tắc rút ra từ chính lần tra này:

**1. Đừng trích từ snippet.** Hai lần trích sai trên ba lần kiểm chứng. Snippet là bản tóm tắt của bản tóm tắt.

**2. Phân tầng chất lượng nguồn.** Paper có bình duyệt và tài liệu chính thức > blog kỹ thuật của công ty > bài tổng hợp. Con số WebMCP kiểu "89% token savings" chỉ xuất hiện trên blog — tôi bỏ, và nói rõ vì sao bỏ. **Nói rõ vì sao bỏ một con số cũng là một dạng bằng chứng về mức độ cẩn thận.**

**3. Trích nguồn làm bài mạnh lên, không yếu đi.** Có người sợ rằng nếu WebMCP/ACP/AP2/CaMeL đã tồn tại thì bài mất tính nguyên bản. Ngược lại. Đóng góp riêng của bài không nằm ở việc phát minh từng cơ chế — nó nằm ở chỗ **ghép chúng lại dưới ba định luật** và chỉ ra chỗ chúng vẫn hở:

- WebMCP cho typed action, **không** giải quyết chuyện site nói dối.
- AP2 cho signed mandate, **không** giải quyết TOCTOU trên legacy web.
- ACP cho scoped token, **không** bảo đảm exactly-one-order.
- CaMeL cho control-flow integrity, **không** trả lời ai chịu trách nhiệm khi hỏng.
- Web Bot Auth cho identity, **không** giải quyết Sybil nếu identity rẻ.

Không có nguồn nào trong số đó nói về **Guarantee ceiling**, **Attention budget** hay **Consent decay**. Đó là ba đóng góp còn lại của bài, và giờ chúng đứng trên nền có thật thay vì đứng trên không khí.

---

## Nguồn

**Giao thức và chuẩn**
- [WebMCP — W3C Web Machine Learning CG (tổng hợp)](https://www.spronta.com/blog/state-of-webmcp-july-2026/)
- [Announcing Agent Payments Protocol (AP2) — Google Cloud](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)
- [AP2 Protocol Documentation](https://ap2-protocol.org/)
- [Agentic Commerce Protocol — Stripe Docs](https://docs.stripe.com/agentic-commerce/acp)
- [Buy it in ChatGPT: Instant Checkout and the Agentic Commerce Protocol — OpenAI](https://openai.com/index/buy-it-in-chatgpt/)
- [Web Bot Auth — Cloudflare docs](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/bots/reference/bot-verification/web-bot-auth.mdx)
- [Message Signatures are now part of our Verified Bots Program — Cloudflare Blog](https://blog.cloudflare.com/verified-bots-with-cryptography/)
- [Reducing CAPTCHAs with Web Bot Auth — AWS Bedrock AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/browser-web-bot-auth.html)
- [draft-meunier-webbotauth-registry — IETF Datatracker](https://datatracker.ietf.org/doc/draft-meunier-webbotauth-registry/)

**Bảo mật agent**
- [Defeating Prompt Injections by Design (CaMeL) — arXiv 2503.18813](https://arxiv.org/abs/2503.18813)
- [CaMeL offers a promising new direction — Simon Willison](https://simonwillison.net/2025/Apr/11/camel/)
- [AgentDojo — OpenReview](https://openreview.net/forum?id=m1YYAQjO3w)
- [Agentic Browser Security: Indirect Prompt Injection in Perplexity Comet — Brave](https://brave.com/blog/comet-prompt-injection/)
- [Researchers discover suite of agentic AI browser vulnerabilities — CyberScoop](https://cyberscoop.com/agentic-ai-browsers-allow-hijacking-zenity-labs-comet/)
- [OpenAI says prompt injection may never be 'solved' — CyberScoop](https://cyberscoop.com/openai-chatgpt-atlas-prompt-injection-browser-agent-security-update-head-of-preparedness/)
- [Continuously hardening ChatGPT Atlas against prompt injection — OpenAI](https://openai.com/index/hardening-atlas-against-prompt-injection/)

**Nền tảng an ninh**
- [Macaroons: Cookies with Contextual Caveats — Google Research, NDSS 2014](https://research.google/pubs/pub41892/)
- [Alice in Warningland — Akhawe & Felt, USENIX Security 2013](https://www.usenix.org/conference/usenixsecurity13/technical-sessions/presentation/akhawe)
- [Alice in Warningland (PDF)](https://static.googleusercontent.com/media/research.google.com/en/us/pubs/archive/41323.pdf)

**Kinh tế và hạ tầng**
- [Cloudflare's new policy pushes AI companies to pay for publishers' content — TechCrunch](https://techcrunch.com/2026/07/01/cloudflares-new-policy-pushes-ai-companies-to-pay-for-publishers-content/)
- [Designing robust and predictable APIs with idempotency — Stripe](https://stripe.com/blog/idempotency)
- [Building an Open Finance Future — Plaid](https://plaid.com/blog/api-progress-update/)
- [Small Move, Big Impact: Plaid's API Migration — Finovate](https://finovate.com/small-move-big-impact-plaids-api-migration-paves-the-way-for-u-s-open-banking-revolution/)
