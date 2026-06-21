import datetime
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

def generate_dsc_certificate(common_name: str, department: str):
    """
    Generates a simulated RSA 2048-bit DSC certificate with standard Indian government attributes.
    """
    # 1. Generate private key
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048
    )

    # 2. Define names
    subject = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "IN"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Andhra Pradesh"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Government of Andhra Pradesh"),
        x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, department),
        x509.NameAttribute(NameOID.COMMON_NAME, common_name),
    ])

    issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "IN"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Andhra Pradesh"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Government of Andhra Pradesh"),
        x509.NameAttribute(NameOID.COMMON_NAME, "CCA India - Class 3 DSC"),
    ])

    # 3. Define validity (365 days)
    valid_from = datetime.datetime.now(datetime.timezone.utc)
    valid_until = valid_from + datetime.timedelta(days=365)
    serial_num = x509.random_serial_number()

    # 4. Build certificate
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(serial_num)
        .not_valid_before(valid_from)
        .not_valid_after(valid_until)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=True,  # non-repudiation
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .sign(private_key, hashes.SHA256())
    )

    # 5. Serialize
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption()
    ).decode("utf-8")

    cert_pem = cert.public_bytes(
        encoding=serialization.Encoding.PEM
    ).decode("utf-8")

    return {
        "private_key": private_key_pem,
        "public_key": cert_pem,
        "serial_number": str(serial_num),
        "valid_from": valid_from,
        "valid_until": valid_until,
        "common_name": common_name,
        "organization": "Government of Andhra Pradesh",
        "issued_by": "CCA India - Class 3 DSC"
    }
