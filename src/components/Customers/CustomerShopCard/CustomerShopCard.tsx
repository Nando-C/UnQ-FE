import { Card } from "react-bootstrap";
import "./CustomerShopCard.css";

interface ShopCardProps {
  name: string;
  cover: string;
  bio?: string;
}

// Photo on top, name and bio under it: the same card in a one-column list on a
// phone and in the two- or three-column grid on wider screens.
const CustomerShopCard = ({ name, cover, bio }: ShopCardProps) => {
  return (
    <Card className="CustomerShopCard">
      <Card.Img variant="top" src={cover} alt="" />
      <Card.Body>
        <Card.Title as="h2">{name}</Card.Title>
        <Card.Text as="p" className="bio">
          {bio}
        </Card.Text>
      </Card.Body>
    </Card>
  );
};

export default CustomerShopCard;
