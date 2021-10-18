import { Card, Col, Image, Row } from "react-bootstrap";
import "./CustomerShopCard.css";

interface ShopCardProps {
  name: string;
  cover: string;
  bio: string;
}

const CustomerShopCard = ({
  // _id,
  name,
  cover,
  bio,
}: ShopCardProps) => {
  return (
    <>
      <Card className="CustomerShopCard">
        <Row className="text-start">
          <Col className="image-col" xs={4}>
            <Image src={cover} rounded fluid className="w-100 h-100" />
          </Col>
          <Col className="pt-2" xs={8}>
            <Card.Subtitle>{name}</Card.Subtitle>
            <Card.Body className="p-0">
              <small>{bio}</small>
            </Card.Body>
          </Col>
        </Row>
      </Card>
    </>
  );
};

export default CustomerShopCard;
