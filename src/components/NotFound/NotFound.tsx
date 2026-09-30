import { Container, Image } from "react-bootstrap";
import { Link } from "react-router-dom";
import wordmark from "../../assets/unq-wordmark-onematerial.svg";
import "./NotFound.css";

// Any address no route matches: a mistyped link, or an old QR code.
const NotFound = () => (
  <Container className="NotFound phone-column text-center">
    <Image src={wordmark} alt="" fluid className="mb-4" style={{ maxWidth: "10rem" }} />
    <h1 className="h4">Page not found</h1>
    <p className="text-body-secondary">
      This link doesn't lead anywhere in UnQ. If it came from a table's QR code, ask the staff for help.
    </p>
    <Link className="btn btn-primary" to="/">
      Go to the home page
    </Link>
  </Container>
);

export default NotFound;
