# Acme CRM — sample `PublishedPlugin`

Đây là deliverable "sample plugin definition" của Day 20. Nó không phải một tool
schema có thêm vài field — nó là đơn vị mà PAL cài đặt, đánh version, cấp quyền,
tính tiền, quan sát và thu hồi.

## Vì sao `PublishedPlugin` chứ không phải `Tool`

Trong PAL hôm nay, Custom API Tools nằm dưới **Assets**, cạnh Knowledge Sources
và Notes — tức tool được trình bày như **tài sản của một workspace**, cùng hạng
với một ghi chú.

Nói cho chính xác: **chưa quan sát thấy một bề mặt `PublishedPlugin` trong bằng
chứng hiện có.** Chưa test đường publish hay share nào. Đây là suy luận từ cách
sản phẩm sắp xếp thông tin, không phải bằng chứng rằng đường đó không tồn tại.

MCP đã chuẩn hoá *tool nói chuyện thế nào*. Thứ còn thiếu là *ai chịu trách nhiệm
cho nó, phiên bản nào đang chạy, nó được phép gửi gì đi đâu, và chuyện gì xảy ra
khi nó chết*. Đó là những field trong file này.

## Năm tool, chọn có chủ đích

| Tool | `effect.classes` | Đảo được? | Vai trò trong bài |
| --- | --- | --- | --- |
| `search_contacts` | `read` | — | Đường đọc. Có `cached_read` kèm `max_staleness` |
| `get_contact` | `read` | — | Tool mà UI resource `contact-card` gọi |
| `add_tag` | `write` | `compensatable` | Effect nhỏ, đảo được → dùng cho Fixture A |
| `remove_tag` | `write` | `compensatable` | Chính là `undo_tool` mà `add_tag` khai |
| `bulk_sync` | `transfer` + `write` | `irreversible` | PII rời tổ chức rồi mới ghi ngược → Fixture B |

`reversibility` không phải một chữ `true`. Nó phải nói hoàn tác **bằng operation
nào**, **trong bao lâu**, và **bảo đảm đến mức nào** — nếu không, một standing
grant đang tựa vào một từ chứ không phải một cơ chế. Và khi đã trỏ tới
`remove_tag` thì tool đó phải tồn tại: `undo_tool` trỏ vào hư không là cùng loại
lỗi với UI resource gọi một tool không có thật.

Chạy publish gate để kiểm:

```bash
node tools/validate-plugin.mjs day20/plugin/acme-crm.plugin.yaml
```

`add_tag` và `bulk_sync` tồn tại tách nhau vì một lý do phương pháp: `bulk_sync`
tự thân đã đủ nguy hiểm để luôn cần approval, nên **không thể dùng nó để chứng
minh authorization phụ thuộc arguments**. Baseline đã là `require_approval` rồi
thì đổi arguments cũng không nói lên điều gì. Fixture A cần một effect đảo được.

## Những field làm việc nặng

**`effect.classes` có giá trị `unknown`.** Thiếu khai báo không được phép âm thầm
coi là `read`. Một tool không khai effect có thể là write, delete hoặc transfer —
và approval từng call là vô nghĩa nếu người duyệt không thấy mình đang duyệt cái
gì.

**`reversibility.mode: irreversible` kéo theo `retry_policy.max_attempts: 1`.** Không bao
giờ tự retry một irreversible write. Nếu timeout, đó là việc của
`ReconciliationRequired`, không phải của backoff.

**`ui.requested_csp_origins` là bề mặt egress thứ hai.** Iframe của plugin tự
khai origin nó muốn tải. Chặn remote plugin ở tầng gateway mà bỏ qua chỗ này thì
dữ liệu vẫn đi ra được qua UI. PAL giao nhau ba tập: plugin xin ∩ registry duyệt
∩ workspace cho phép.

**`approval.surface: host_rendered`.** Plugin đề nghị, PAL cho phép. Sandbox của
MCP Apps bảo vệ *host khỏi app*, nó không nói gì về việc app hiển thị sai sự thật
cho *người dùng*.

**`availability.approval_deadline` phải nhỏ hơn `ttlMs` của task.** Nếu con người
duyệt sau khi task hết hạn, PAL đánh dấu `expired`. Từ đó rẽ hai nhánh, không
phải một: chạy lại `prepare` **chỉ khi** PAL cưỡng chế được tính side-effect-free
của bước đó; còn không thì `ReconciliationRequired`. Không bao giờ commit trên
một EffectManifest cũ, và cũng không bao giờ âm thầm thử lại một việc có thể đã
xảy ra một lần rồi.

## Fixtures

`fixtures/fixture-a-argument-aware.json` và `fixtures/fixture-b-dangerous-path.json`
là cùng bộ dữ liệu mà Firewall trên trang chạy và mà `pal plugin test` sẽ chạy.
Mỗi case có `verdict` và `reason` xác định. Không case nào dùng chữ "may" — một
fixture không có kết quả xác định thì không phải fixture.

## Điều file này không chứng minh

Chữ ký phủ `metadata` và `spec`. Nó **không** phủ, và không thể phủ, hành vi thật
của remote server khi bị gọi. Một server đổi code mà giữ nguyên schema sẽ qua mọi
lần kiểm hash.
