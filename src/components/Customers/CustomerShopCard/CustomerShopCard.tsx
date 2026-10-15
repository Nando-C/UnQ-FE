import { ReactNode } from "react";
import { Card } from "react-bootstrap";
import { Link } from "react-router-dom";
import "./CustomerShopCard.css";

interface ShopCardProps {
  name: string;
  cover: string;
  bio?: string;
  // With `to`, the photo and the name are the link and `children` sit under
  // them in the same card (My Shops, where a card also carries the shop's
  // figures with links of their own). Without it, the caller wraps the card.
  to?: string;
  children?: ReactNode;
}

// Photo on top, name and bio under it: the same card in a one-column list on a
// phone and in the two- or three-column grid on wider screens.
const CustomerShopCard = ({ name, cover, bio, to, children }: ShopCardProps) => {
  const top = (
    <>
      <Card.Img variant="top" src={cover} alt="" />
      <Card.Body>
        <Card.Title as="h2">{name}</Card.Title>
        <Card.Text as="p" className="bio">
          {bio}
        </Card.Text>
      </Card.Body>
    </>
  );
  return (
    <Card className="CustomerShopCard">
      {to ? (
        <Link className="shop-link" to={to}>
          {top}
        </Link>
      ) : (
        top
      )}
      {children}
    </Card>
  );
};

export default CustomerShopCard;
