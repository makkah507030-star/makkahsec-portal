// src/components/SignedMark.jsx
// خانة توقيع في النماذج المطبوعة: صورة توقيع صاحبها من «توقيعي» إن وُجدت،
// وإلا «✓ وُقّع إلكترونيًا» (src/lib/userSignatures.js ← useSignerImages)
export default function SignedMark({ url }) {
  return url
    ? <img src={url} alt="توقيع" style={{ height: 30, maxWidth: 110, objectFit: "contain", display: "inline-block", verticalAlign: "middle" }} />
    : <span style={{ color: "#2f7a4f" }}>✓ وُقّع إلكترونيًا</span>;
}
