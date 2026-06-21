import base64
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from cryptography.x509 import load_pem_x509_certificate

def sign_text_content(text_data: str, key_pem: str) -> str:
    """
    Signs plain text using RSA-SHA256 private key, returning base64 signature.
    """
    private_key = load_pem_private_key(key_pem.encode("utf-8"), password=None)
    signature = private_key.sign(
        text_data.encode("utf-8"),
        padding.PKCS1v15(),
        hashes.SHA256()
    )
    return base64.b64encode(signature).decode("utf-8")

def verify_text_signature(text_data: str, signature_b64: str, cert_pem: str) -> bool:
    """
    Verifies base64 signature against plain text using the certificate's public key.
    """
    try:
        cert = load_pem_x509_certificate(cert_pem.encode("utf-8"))
        public_key = cert.public_key()
        signature = base64.b64decode(signature_b64)
        public_key.verify(
            signature,
            text_data.encode("utf-8"),
            padding.PKCS1v15(),
            hashes.SHA256()
        )
        return True
    except Exception:
        return False
        
def get_subject_from_cert(cert_pem: str) -> str:
    """
    Extracts the common name from a certificate PEM.
    """
    try:
        cert = load_pem_x509_certificate(cert_pem.encode("utf-8"))
        for attr in cert.subject:
            if attr.oid._name == "commonName":
                return attr.value
        return cert.subject.rfc4514_string()
    except Exception:
        return "Unknown Officer"
