import { ReactNode } from "react";
import { Button, Col, Container, Image, Row } from "react-bootstrap";
import { FcGoogle } from "react-icons/fc";
import wordmark from "../../assets/unq-wordmark-onematerial.svg";
import "../Register/Register.css";

// The log-in and sign-up pages' shared frame: the wordmark beside the form
// (above it on phones), and the page's heading for screen readers.
export const AuthLayout = ({ title, children }: { title: string; children: ReactNode }) => (
  <Container className="Register text-center">
    <h1 className="visually-hidden">{title}</h1>
    <Row className="align-items-center">
      <Col xs={12} sm={6}>
        <Image src={wordmark} alt="UnQ" fluid style={{ maxWidth: "22rem" }} />
      </Col>
      <Col xs={12} sm={6}>
        {children}
      </Col>
    </Row>
  </Container>
);

// Google sign-in. The same for both pages: the BE signs a Google account in,
// creating it first if it's new.
export const GoogleButton = ({ label }: { label: string }) => (
  <Button
    className="border"
    variant="light"
    as="a"
    href={`${import.meta.env.VITE_BE_URL}/auth/googleLogin`}
  >
    <FcGoogle className="me-2" size={25} />
    {label}
  </Button>
);
