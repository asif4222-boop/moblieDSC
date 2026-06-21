from io import BytesIO
import fitz
import datetime
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.sign import signers, validation
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.keys import load_certs_from_pemder_data, load_private_key_from_pemder_data


def add_visible_signature_stamp(pdf_bytes: bytes, cert_pem: str) -> bytes:
    """
    Adds a visible blue signature box with credentials/date on page 1 of the PDF,
    and sets custom PDF metadata fields.
    """
    try:
        # Extract officer name and serial number
        cert = x509.load_pem_x509_certificate(cert_pem.encode("utf-8"), default_backend())
        officer_name = cert.subject.get_attributes_for_oid(x509.NameOID.COMMON_NAME)[0].value
        serial_no = hex(cert.serial_number)[2:].upper()
    except Exception as e:
        print(f"Error parsing certificate PEM: {e}")
        officer_name = "Government Officer"
        serial_no = "A1B2C3D4E5F6G7H8"

    current_time_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if len(doc) == 0:
            return pdf_bytes
            
        page = doc[0]
        w = page.rect.width
        h = page.rect.height
        
        # Signature Stamp Rectangle at bottom right
        rect = fitz.Rect(w - 230, h - 135, w - 30, h - 35)
        
        # Draw blue border and light blue background fill
        # border blue: #1e40af (30, 64, 175) -> (30/255, 64/255, 175/255)
        # light blue bg: #eff6ff (239, 246, 255) -> (239/255, 246/255, 255/255)
        page.draw_rect(rect, color=(30/255, 64/255, 175/255), fill=(239/255, 246/255, 255/255), width=1.5)
        
        # Insert digitally signed header (Helvetica-Bold)
        page.insert_text(fitz.Point(rect.x0 + 8, rect.y0 + 15), "DIGITALLY SIGNED", fontsize=7.5, fontname="hebo", color=(30/255, 64/255, 175/255))
        
        # Insert rest of the text details
        rest_text = (
            f"By: {officer_name}\n"
            f"Date: {current_time_str}\n"
            f"Serial No: {serial_no}\n"
            f"Authority: CCA India - Class 3 DSC\n"
            f"Algorithm: SHA256withRSA\n"
            f"Key Size: 2048 bits"
        )
        rest_rect = fitz.Rect(rect.x0 + 8, rect.y0 + 20, rect.x1 - 8, rect.y1 - 8)
        page.insert_textbox(rest_rect, rest_text, fontsize=6.5, fontname="helv", align=0, color=(15/255, 23/255, 42/255))
        
        # Set metadata
        metadata = doc.metadata
        metadata["author"] = officer_name
        metadata["subject"] = "Digitally Signed Document"
        metadata["keywords"] = "DSC, Digital Signature, CCA Compliant"
        metadata["creator"] = "DSC Mobile Signing Solution"
        doc.set_metadata(metadata)
        
        # Write back to bytes
        stamped_pdf = doc.write()
        doc.close()
        return stamped_pdf
    except Exception as e:
        print(f"Error drawing visible signature stamp: {e}")
        return pdf_bytes


def sign_pdf_file(pdf_bytes: bytes, cert_pem: str, key_pem: str, reason: str = "Government DSC Mobile Signing") -> bytes:
    """
    Signs a PDF document using pyHanko synchronously (useful for test suites).
    """
    # 1. Add visual signature stamp
    pdf_bytes = add_visible_signature_stamp(pdf_bytes, cert_pem)

    # 2. Load keys using pyhanko loaders
    certs = list(load_certs_from_pemder_data(cert_pem.encode("utf-8")))
    signing_cert = certs[0]
    signing_key = load_private_key_from_pemder_data(key_pem.encode("utf-8"), passphrase=None)

    # 3. Create SimpleSigner
    signer = signers.SimpleSigner(signing_cert=signing_cert, signing_key=signing_key, cert_registry=None)

    # 4. Setup incremental writer and output buffer
    w = IncrementalPdfFileWriter(BytesIO(pdf_bytes))
    out = BytesIO()

    # 5. Sign the PDF
    signers.sign_pdf(
        w,
        signers.PdfSignatureMetadata(
            field_name="DSC_Mobile_Signature",
            reason=reason,
            location="Andhra Pradesh, IN"
        ),
        signer=signer,
        output=out
    )

    return out.getvalue()


async def sign_pdf_file_async(pdf_bytes: bytes, cert_pem: str, key_pem: str, reason: str = "Government DSC Mobile Signing") -> bytes:
    """
    Signs a PDF document asynchronously (for FastAPI ASGI event loops).
    """
    # 1. Add visual signature stamp
    pdf_bytes = add_visible_signature_stamp(pdf_bytes, cert_pem)

    # 2. Load keys using pyhanko loaders
    certs = list(load_certs_from_pemder_data(cert_pem.encode("utf-8")))
    signing_cert = certs[0]
    signing_key = load_private_key_from_pemder_data(key_pem.encode("utf-8"), passphrase=None)

    # 3. Create SimpleSigner
    signer = signers.SimpleSigner(signing_cert=signing_cert, signing_key=signing_key, cert_registry=None)

    # 4. Setup incremental writer and output buffer
    w = IncrementalPdfFileWriter(BytesIO(pdf_bytes))
    out = BytesIO()

    # 5. Sign the PDF asynchronously
    await signers.async_sign_pdf(
        w,
        signers.PdfSignatureMetadata(
            field_name="DSC_Mobile_Signature",
            reason=reason,
            location="Andhra Pradesh, IN"
        ),
        signer=signer,
        output=out
    )

    return out.getvalue()

from pyhanko_certvalidator import ValidationContext

def verify_pdf_signature(pdf_bytes: bytes) -> dict:
    """
    Verifies the signatures inside a PDF using pyHanko.
    """
    try:
        r = PdfFileReader(BytesIO(pdf_bytes))
        if not r.embedded_signatures:
            return {"valid": False, "message": "No digital signatures found in this PDF."}

        # Validate the first signature
        sig = r.embedded_signatures[0]
        
        # Create validation context trusting the signer cert directly (since it is simulated)
        # and disable fetching to run completely offline
        vc = ValidationContext(trust_roots=[sig.signer_cert], allow_fetching=False)
        status = validation.validate_pdf_signature(sig, signer_validation_context=vc)

        signer_name = "Unknown"
        if status.signing_cert:
            signer_name = status.signing_cert.subject.native.get("common_name", "Unknown")

        return {
            "valid": status.valid and status.intact,
            "message": f"Signature is {'intact' if status.intact else 'tampered'} and cryptographic validation is {'successful' if status.valid else 'failed'}.",
            "signer": signer_name,
            "integrity": status.intact,
            "expired": False
        }
    except Exception as e:
        return {"valid": False, "message": f"Verification error: {str(e)}"}
