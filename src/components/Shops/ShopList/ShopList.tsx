import { Link } from "react-router-dom";
import { useAppSelector } from "../../../redux/app/hooks";
import { selectShopsData } from "../../../redux/slices/shopSlice";
import CustomerShopCard from "../../Customers/CustomerShopCard/CustomerShopCard";

// The same photo-on-top card and grid customers see on their home page, so a
// manager sees their shops the way customers will.
const ShopList = () => {
  const shopListStore = useAppSelector(selectShopsData);

  return (
    <ul className="ShopList shop-grid list-unstyled">
      {shopListStore.map((shop) => (
        <li key={shop._id}>
          <Link className="shop-link" to={`/shop/${shop._id}`}>
            <CustomerShopCard
              name={shop.name}
              cover={shop.cover}
              bio={shop.bio}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default ShopList;
