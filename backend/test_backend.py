import os
import sys
import io
import unittest
from datetime import datetime

# Adjust path to import backend modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from signing.certificate import generate_dsc_certificate
from signing.pdf_signer import sign_pdf_file, verify_pdf_signature
from signing.text_signer import sign_text_content, verify_text_signature

def generate_minimal_pdf() -> bytes:
    """
    Generates a valid minimal PDF with dynamically computed xref offsets
    to prevent CRLF/LF issues.
    """
    header = b"%PDF-1.4\n"
    
    obj1 = b"1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n"
    obj2 = b"2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n"
    obj3 = b"3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources <<>> /Contents 4 0 R>>\nendobj\n"
    obj4 = b"4 0 obj\n<</Length 24>>\nstream\nBT /F1 12 Tf 70 700 Td (Hello World) Tj ET\nendstream\nendobj\n"
    
    offset_1 = len(header)
    offset_2 = offset_1 + len(obj1)
    offset_3 = offset_2 + len(obj2)
    offset_4 = offset_3 + len(obj3)
    
    xref_offset = offset_4 + len(obj4)
    
    xref_entries = [
        b"0000000000 65535 f\r\n",
        f"{offset_1:010d} 00000 n\r\n".encode("ascii"),
        f"{offset_2:010d} 00000 n\r\n".encode("ascii"),
        f"{offset_3:010d} 00000 n\r\n".encode("ascii"),
        f"{offset_4:010d} 00000 n\r\n".encode("ascii"),
    ]
    
    xref_table = b"xref\r\n0 5\r\n" + b"".join(xref_entries)
    trailer = b"trailer\r\n<</Size 5 /Root 1 0 R>>\r\n"
    startxref = f"startxref\r\n{xref_offset}\r\n%%EOF\r\n".encode("ascii")
    
    return header + obj1 + obj2 + obj3 + obj4 + xref_table + trailer + startxref

class TestDSCBackend(unittest.TestCase):
    def test_certificate_generation(self):
        print("\n--- Testing Certificate Generation ---")
        cert_data = generate_dsc_certificate("Test Officer", "Revenue Department")
        self.assertIsNotNone(cert_data["private_key"])
        self.assertIsNotNone(cert_data["public_key"])
        self.assertEqual(cert_data["common_name"], "Test Officer")
        self.assertEqual(cert_data["organization"], "Government of Andhra Pradesh")
        self.assertEqual(cert_data["issued_by"], "CCA India - Class 3 DSC")
        print("[OK] Certificate generated successfully!")

    def test_text_signing_and_verification(self):
        print("\n--- Testing Text Signing & Verification ---")
        cert_data = generate_dsc_certificate("Test Officer", "Revenue Department")
        text_content = "This is a digital file to sign."
        
        # Sign
        signature = sign_text_content(text_content, cert_data["private_key"])
        self.assertIsNotNone(signature)
        print("[OK] Text signed. Signature B64 length:", len(signature))
        
        # Verify
        is_valid = verify_text_signature(text_content, signature, cert_data["public_key"])
        self.assertTrue(is_valid)
        print("[OK] Text signature verified successfully!")

        # Verify with modified content (should fail)
        is_valid_bad = verify_text_signature(text_content + " tampered", signature, cert_data["public_key"])
        self.assertFalse(is_valid_bad)
        print("[OK] Tampered text signature verification failed correctly!")

    def test_pdf_signing_and_verification(self):
        print("\n--- Testing PDF Signing & Verification ---")
        cert_data = generate_dsc_certificate("Test Officer", "Revenue Department")
        
        # Generate valid minimal PDF
        mock_pdf = generate_minimal_pdf()

        # Sign PDF
        signed_pdf = sign_pdf_file(mock_pdf, cert_data["public_key"], cert_data["private_key"])
        self.assertIsNotNone(signed_pdf)
        self.assertGreater(len(signed_pdf), len(mock_pdf))
        print("[OK] PDF signed. Original size:", len(mock_pdf), "Signed size:", len(signed_pdf))

        # Verify PDF Signature
        result = verify_pdf_signature(signed_pdf)
        self.assertTrue(result["valid"])
        self.assertTrue(result["integrity"])
        self.assertEqual(result["signer"], "Test Officer")
        print("[OK] Signed PDF verified successfully! Signer:", result["signer"])

if __name__ == "__main__":
    unittest.main()
